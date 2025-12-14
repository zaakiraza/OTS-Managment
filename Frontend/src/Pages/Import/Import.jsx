import { useState } from "react";
import axios from "axios";
import SideBar from "../../Components/SideBar/SideBar";
import "./Import.css";

const Import = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResults(null);
    setError("");
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5003/api/import/upload",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setResults(response.data.results);
        setFile(null);
        document.getElementById("fileInput").value = "";
      }
    } catch (error) {
      console.error("Import error:", error);
      setError(error.response?.data?.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <SideBar />
      <div className="main-content">
        <div className="import-container">
          <div className="page-header">
            <h1>Import Attendance</h1>
            <p>Upload attendance data from biometric device USB export</p>
          </div>

          <div className="import-card">
            {error && (
              <div className="error-message">
                <i className="fas fa-times-circle"></i> {error}
              </div>
            )}

            {results && (
              <div className="success-message">
                <i className="fas fa-check-circle"></i> Attendance imported successfully!
              </div>
            )}

            <div className="upload-section">
              <h3>Select Attendance File</h3>
              <p className="help-text">
                Export attendance data from your biometric device to USB, then
                upload the .dat file here
              </p>

              <div className="file-input-wrapper">
                <input
                  type="file"
                  id="fileInput"
                  accept=".dat,.txt"
                  onChange={handleFileChange}
                  className="file-input"
                />
                <label htmlFor="fileInput" className="file-label">
                  {file ? file.name : "Choose File"}
                </label>
              </div>

              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="btn-import"
              >
                {loading ? "Importing..." : "Import Attendance"}
              </button>
            </div>

            {results && (
              <div className="results-section">
                <h3>Import Results</h3>
                <div className="stats-grid">
                  <div className="stat-card success">
                    <div className="stat-value">{results.processed}</div>
                    <div className="stat-label">Processed</div>
                  </div>
                  <div className="stat-card warning">
                    <div className="stat-value">{results.skipped}</div>
                    <div className="stat-label">Skipped</div>
                  </div>
                  <div className="stat-card error">
                    <div className="stat-value">{results.errors}</div>
                    <div className="stat-label">Errors</div>
                  </div>
                </div>

                <div className="details-section">
                  <h4>Details</h4>
                  <div className="details-list">
                    {results.details.map((detail, index) => (
                      <div
                        key={index}
                        className={`detail-item ${detail.status.replace(' ', '-')}`}
                      >
                        <span className="detail-id">
                          {detail.biometricId || "N/A"}
                        </span>
                        <span className="detail-name">
                          {detail.employeeName || "-"}
                        </span>
                        <span className="detail-time">{detail.dateTime}</span>
                        <span className={`detail-status status-${detail.status.replace(' ', '-')}`}>
                          {detail.status}
                        </span>
                        {detail.reason && (
                          <span className="detail-reason">{detail.reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="instructions-card">
            <h3><i className="fas fa-info-circle"></i> Instructions</h3>
            <ol>
              <li>Format USB drive to FAT32</li>
              <li>On device: Menu → USB Manager → Download Attendance</li>
              <li>Wait for device to save attendance data to USB</li>
              <li>Remove USB and plug into computer</li>
              <li>Upload the .dat file using the form above</li>
              <li>System will automatically match biometric IDs to employees</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Import;
