import React, { useState, useEffect, useRef } from "react";
import {
  FeatureManager,
  UserAttributes,
  FeatureConfig,
} from "./FeatureManager";

import { v4 as uuidv4 } from "uuid";

// Import Recharts components
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface RolloutSimulatorProps {
  platform: string;
  platformData: FeatureConfig | null;
  featureId: string;
  userAttributes: UserAttributes;
}

const RolloutSimulator: React.FC<RolloutSimulatorProps> = ({
  platform,
  platformData,
  featureId,
  userAttributes,
}) => {
  const [numUsers, setNumUsers] = useState(1000);
  const [simulationDuration, setSimulationDuration] = useState(20); // Duration in seconds
  const [simulationData, setSimulationData] = useState<
    { value: any; count: number; percentage: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [usersSimulated, setUsersSimulated] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const usersSimulatedRef = useRef<number>(0);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleSimulate = () => {
    try {
      setError(null);
      setSimulationData([]);
      setIsSimulating(true);
      setUsersSimulated(0);
      usersSimulatedRef.current = 0;

      if (!platformData) {
        throw new Error("Platform data is not available.");
      }

      if (!featureId) {
        throw new Error("Please select a feature.");
      }

      const featureManager = new FeatureManager(
        platformData,
        "", // We'll set userId individually for each user
        userAttributes
      );

      const valueCounts = new Map<any, number>();

      const totalUsers = numUsers;
      const intervalDuration = (simulationDuration * 1000) / totalUsers; // Time between each user simulation in milliseconds

      intervalRef.current = setInterval(() => {
        if (usersSimulatedRef.current >= totalUsers) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsSimulating(false);
          return;
        }

        usersSimulatedRef.current++;

        const simulatedUserId = uuidv4();
        featureManager.setUserId(simulatedUserId);

        const result = featureManager.getFeatureValue(featureId);

        const currentCount = valueCounts.get(result.value) || 0;
        valueCounts.set(result.value, currentCount + 1);

        // Update simulation data
        const updatedData = Array.from(valueCounts.entries())
          .map(([value, count]) => ({
            value: String(value),
            count,
            percentage: ((count / usersSimulatedRef.current) * 100).toFixed(2),
          }))
          .sort((a, b) => a.value.localeCompare(b.value));

        setSimulationData(updatedData);
        setUsersSimulated(usersSimulatedRef.current);
      }, intervalDuration);
    } catch (err) {
      setError((err as Error).message);
      setIsSimulating(false);
    }
  };

  return (
    <div>
      <h2>Rollout Simulator</h2>
      <div>
        <label>
          Number of Users to Simulate:
          <input
            type="number"
            value={numUsers}
            onChange={(e) => setNumUsers(parseInt(e.target.value, 10))}
            min={1}
            max={100000}
            disabled={isSimulating}
          />
        </label>
      </div>
      <div>
        <label>
          Simulation Duration (seconds):
          <input
            type="number"
            value={simulationDuration}
            onChange={(e) =>
              setSimulationDuration(parseInt(e.target.value, 10))
            }
            min={1}
            max={300}
            disabled={isSimulating}
          />
        </label>
      </div>
      <button type="button" onClick={handleSimulate} disabled={isSimulating}>
        {isSimulating ? "Simulation Running..." : "Start Simulation"}
      </button>
      {simulationData.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>
            Simulation Progress: {usersSimulated} / {numUsers} users simulated (
            {((usersSimulated / numUsers) * 100).toFixed(2)}%)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={simulationData}>
              <XAxis dataKey="value" />
              <YAxis />
              <Tooltip
                formatter={(value, name, props) => {
                  const percentage = simulationData.find(
                    (item) => item.value === props.payload.value
                  )?.percentage;
                  return [`${value} users (${percentage}%)`, "Count"];
                }}
              />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" label={{ position: "top" }}>
                {simulationData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.value === "true" ? "#82ca9d" : "#8884d8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table
            style={{ marginTop: "20px", width: "100%", textAlign: "left" }}
          >
            <thead>
              <tr>
                <th>Value</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {simulationData.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.value}</td>
                  <td>{entry.count}</td>
                  <td>{entry.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && (
        <div style={{ color: "red" }}>
          <h3>Error: {error}</h3>
        </div>
      )}
    </div>
  );
};

export default RolloutSimulator;
