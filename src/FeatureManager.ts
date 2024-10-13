import murmurhash from "murmurhash";

// Define data models
export interface Rollout {
  percentage: number;
  secondaryValue: any;
}

export interface Segment {
  combo: { [key: string]: string[] };
  value: any;
  rollout?: Rollout | null;
}

export interface Feature {
  id: string;
  description: string;
  type: string;
  value: any;
  segments: Segment[];
  rollout?: Rollout | null;
}

export interface FeatureGroup {
  id: string;
  description: string;
  features: Feature[];
}

export interface FeatureConfig {
  groups: FeatureGroup[];
}

export interface UserAttributes {
  [key: string]: string;
}

export interface FeatureEvaluationResult {
  value: any;
  reasoning: string[];
}

// FeatureManager class
export class FeatureManager {
  private featureMap: Map<string, { feature: Feature; groupId: string }>;
  private userId: string;
  private userAttributes: UserAttributes;

  constructor(
    config: FeatureConfig,
    userId: string,
    userAttributes: UserAttributes
  ) {
    this.userId = userId;
    this.userAttributes = userAttributes;
    this.featureMap = new Map();

    // Flatten features into a map for quick access, including groupId
    for (const group of config.groups) {
      for (const feature of group.features) {
        this.featureMap.set(feature.id, { feature, groupId: group.id });
      }
    }
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public getFeatureValue(featureId: string): FeatureEvaluationResult {
    const featureEntry = this.featureMap.get(featureId);

    if (!featureEntry) {
      throw new Error(`Feature with id "${featureId}" not found.`);
    }

    const { feature, groupId } = featureEntry;
    const reasoning: string[] = [];
    let finalValue: any;

    // Evaluate segments in order
    for (const segment of feature.segments) {
      if (this.matchSegment(segment.combo, this.userAttributes, reasoning)) {
        reasoning.push(`Segment matched: ${JSON.stringify(segment.combo)}`);
        finalValue = segment.value;

        // Handle segment-level rollout
        if (segment.rollout) {
          const beforeRolloutValue = finalValue;
          finalValue = this.evaluateRollout(
            this.userId,
            groupId,
            segment.rollout,
            finalValue,
            reasoning
          );
          reasoning.push(
            `Segment-level rollout applied: ${segment.rollout.percentage}% users get ${beforeRolloutValue}, others get ${segment.rollout.secondaryValue}`
          );
        } else {
          reasoning.push(`No segment-level rollout applied.`);
        }

        reasoning.push(`Final value from segment: ${finalValue}`);
        return { value: finalValue, reasoning };
      } else {
        reasoning.push(
          `Segment did not match: ${JSON.stringify(segment.combo)}`
        );
      }
    }

    // If no segments match, use default value
    reasoning.push(`No segments matched. Using default value.`);
    finalValue = feature.value;

    // Handle feature-level rollout
    if (feature.rollout) {
      const beforeRolloutValue = finalValue;
      finalValue = this.evaluateRollout(
        this.userId,
        groupId,
        feature.rollout,
        finalValue,
        reasoning
      );
      reasoning.push(
        `Feature-level rollout applied: ${feature.rollout.percentage}% users get ${beforeRolloutValue}, others get ${feature.rollout.secondaryValue}`
      );
    } else {
      reasoning.push(`No feature-level rollout applied.`);
    }

    reasoning.push(`Final value: ${finalValue}`);
    return { value: finalValue, reasoning };
  }

  private matchSegment(
    combo: { [key: string]: string[] },
    userAttributes: UserAttributes,
    reasoning: string[]
  ): boolean {
    for (const [attributeKey, values] of Object.entries(combo)) {
      const userValue = userAttributes[attributeKey];

      if (!userValue) {
        reasoning.push(
          `User attribute "${attributeKey}" not present. Segment does not match.`
        );
        return false;
      }

      let matchFound = false;

      for (const value of values) {
        if (value.startsWith("!")) {
          // Negation
          const negatedValue = value.slice(1);
          if (userValue !== negatedValue) {
            matchFound = true;
          } else {
            reasoning.push(
              `User attribute "${attributeKey}" value "${userValue}" matches negated value "${negatedValue}". Segment does not match.`
            );
            return false;
          }
        } else {
          // Positive match
          if (userValue === value) {
            matchFound = true;
          }
        }
      }

      if (!matchFound) {
        reasoning.push(
          `No matching value for attribute "${attributeKey}". Segment does not match.`
        );
        return false;
      }
    }

    // All conditions matched
    return true;
  }

  private evaluateRollout(
    userId: string,
    groupId: string,
    rollout: Rollout,
    currentValue: any,
    reasoning: string[]
  ): any {
    const hash = this.hashUser(userId, groupId);
    const percentage = rollout.percentage;

    reasoning.push(
      `Evaluating rollout: Hash(${userId}, ${groupId}) = ${hash}, Rollout percentage = ${percentage}%`
    );

    if (hash < percentage) {
      // User falls within rollout percentage; use primary value
      reasoning.push(
        `User falls within rollout percentage. Using value: ${currentValue}`
      );
      return currentValue;
    } else {
      // Use secondary value
      reasoning.push(
        `User does not fall within rollout percentage. Using secondary value: ${rollout.secondaryValue}`
      );
      return rollout.secondaryValue;
    }
  }

  private hashUser(userId: string, groupId: string): number {
    const str = `${userId}-${groupId}`;
    const hash = murmurhash.v3(str);
    // Convert hash to a value between 0 and 99
    return Math.abs(hash) % 100;
  }
}
