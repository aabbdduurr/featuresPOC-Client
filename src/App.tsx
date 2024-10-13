import React, { useState, useEffect } from "react";
import {
  FeatureManager,
  UserAttributes,
  FeatureConfig,
  FeatureEvaluationResult,
} from "./FeatureManager";
import "./App.css";
import RolloutSimulator from "./RolloutSimulator";

function App() {
  const [userId, setUserId] = useState("");
  const [platformsList, setPlatformsList] = useState<string[]>([]);
  const [platform, setPlatform] = useState("");
  const [platformData, setPlatformData] = useState<FeatureConfig | null>(null);
  const [featuresList, setFeaturesList] = useState<string[]>([]);
  const [featureId, setFeatureId] = useState("");
  const [attributesInput, setAttributesInput] = useState("");
  const [parsedUserAttributes, setParsedUserAttributes] =
    useState<UserAttributes>({});
  const [featureValue, setFeatureValue] =
    useState<FeatureEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingPlatforms, setIsFetchingPlatforms] =
    useState<boolean>(false);
  const [isFetchingFeatures, setIsFetchingFeatures] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<"evaluate" | "simulate">(
    "evaluate"
  );

  useEffect(() => {
    // Fetch the list of platforms on component mount
    const fetchPlatforms = async () => {
      setIsFetchingPlatforms(true);
      try {
        const response = await fetch(
          "https://togglespoc.s3.amazonaws.com/platforms.json"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch platforms list.");
        }
        const platforms = await response.json();
        setPlatformsList(platforms);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsFetchingPlatforms(false);
      }
    };

    fetchPlatforms();
  }, []);

  useEffect(() => {
    // Reset features list, feature ID, and platform data when platform changes
    setFeaturesList([]);
    setFeatureId("");
    setFeatureValue(null);
    setPlatformData(null);
    setError(null);

    if (platform) {
      // Fetch features for the selected platform
      const fetchFeatures = async () => {
        setIsFetchingFeatures(true);
        try {
          const response = await fetch(
            `https://togglespoc.s3.amazonaws.com/platforms/${encodeURIComponent(
              platform
            )}.json`
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch data for platform "${platform}".`);
          }

          const featureConfig: FeatureConfig = await response.json();

          // Extract feature IDs
          const features = featureConfig.groups.flatMap((group) =>
            group.features.map((feature) => feature.id)
          );

          setFeaturesList(features);
          setPlatformData(featureConfig); // Store platform data
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setIsFetchingFeatures(false);
        }
      };

      fetchFeatures();
    }
  }, [platform]);

  useEffect(() => {
    // Parse attributes input into an object
    const userAttributes: UserAttributes = {};
    const lines = attributesInput.split("\n");
    lines.forEach((line) => {
      const [key, value] = line.split("=").map((s) => s.trim());
      if (key && value) {
        userAttributes[key] = value;
      }
    });
    console.log(userAttributes);
    setParsedUserAttributes(userAttributes);
  }, [attributesInput]);

  const handleEvaluate = () => {
    try {
      setError(null);
      setFeatureValue(null);

      if (!platform) {
        setError("Please select a platform.");
        return;
      }

      if (!featureId) {
        setError("Please select a feature.");
        return;
      }

      if (!platformData) {
        setError("Platform data is not available.");
        return;
      }

      // Create FeatureManager instance
      const featureManager = new FeatureManager(
        platformData,
        userId,
        parsedUserAttributes
      );

      // Get feature evaluation result
      const result = featureManager.getFeatureValue(featureId);

      setFeatureValue(result);
    } catch (err) {
      setError((err as Error).message);
      setFeatureValue(null);
    }
  };

  return (
    <div className="App">
      <h1>Feature Toggle Simulator</h1>
      <div className="navigation">
        <button
          onClick={() => setCurrentPage("evaluate")}
          disabled={currentPage === "evaluate"}
        >
          Feature Evaluation
        </button>
        <button
          onClick={() => setCurrentPage("simulate")}
          disabled={currentPage === "simulate"}
        >
          Rollout Simulator
        </button>
      </div>
      <form>
        <div>
          <label>
            Platform:
            {isFetchingPlatforms ? (
              <span className="loading">Loading platforms...</span>
            ) : (
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="">Select a platform</option>
                {platformsList.map((plat) => (
                  <option key={plat} value={plat}>
                    {plat}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
        <div>
          <label>
            Feature:
            {isFetchingFeatures ? (
              <span className="loading">Loading features...</span>
            ) : (
              <select
                value={featureId}
                onChange={(e) => setFeatureId(e.target.value)}
                disabled={!featuresList.length}
              >
                <option value="">Select a feature</option>
                {featuresList.map((feat) => (
                  <option key={feat} value={feat}>
                    {feat}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
        <div>
          <label>
            User Attributes (one per line, format: key=value):
            <textarea
              value={attributesInput}
              onChange={(e) => setAttributesInput(e.target.value)}
              placeholder="e.g., region=US\nage=30-35"
              rows={5}
            />
          </label>
        </div>
        {currentPage === "evaluate" && (
          <>
            <div>
              <label>
                User ID:
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter user ID"
                />
              </label>
            </div>
            <button type="button" onClick={handleEvaluate}>
              Evaluate Feature
            </button>
            {featureValue !== null && (
              <div className="result">
                <h2>Feature Value: {String(featureValue.value)}</h2>
                <h3>Evaluation Reasoning:</h3>
                <ul>
                  {featureValue.reasoning.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {currentPage === "simulate" && (
          <RolloutSimulator
            platform={platform}
            platformData={platformData}
            featureId={featureId}
            userAttributes={parsedUserAttributes}
          />
        )}
      </form>
      {error && (
        <div className="error">
          <h2>Error: {error}</h2>
        </div>
      )}
    </div>
  );
}

export default App;
