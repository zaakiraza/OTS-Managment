import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { assetAPI } from "../../Config/Api";
import "../Assets/Assets.css";

function MyAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchMyAssets();
  }, []);

  const fetchMyAssets = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await assetAPI.getAll();
      
      if (response.data.success) {
        // Filter assets assigned to current employee
        const myAssets = response.data.data.filter(
          (asset) => asset.assignedTo?._id === user._id
        );
        setAssets(myAssets);
      }
    } catch (error) {
      console.error("Error fetching my assets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      Available: "#10b981",
      Assigned: "#3b82f6",
      "Under Repair": "#f59e0b",
      Damaged: "#ef4444",
      Retired: "#6b7280",
    };
    return colors[status] || "#999";
  };

  const getConditionColor = (condition) => {
    const colors = {
      Excellent: "#10b981",
      Good: "#3b82f6",
      Fair: "#f59e0b",
      Poor: "#ef4444",
    };
    return colors[condition] || "#999";
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="assets-page">
          <div className="page-header">
            <div>
              <h1>My Assets</h1>
              <p>View IT assets assigned to you</p>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <h3>Total Assets</h3>
                <p className="stat-value">{assets.length}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Good Condition</h3>
                <p className="stat-value" style={{ color: "#10b981" }}>
                  {assets.filter((a) => a.condition === "Good" || a.condition === "Excellent").length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <h3>Needs Attention</h3>
                <p className="stat-value" style={{ color: "#f59e0b" }}>
                  {assets.filter((a) => a.condition === "Fair" || a.condition === "Poor").length}
                </p>
              </div>
            </div>
          </div>

          {/* Assets Grid */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Assigned Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      Loading...
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center" }}>
                      No assets assigned to you
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset._id}>
                      <td>
                        <span className="asset-id-badge">{asset.assetId}</span>
                      </td>
                      <td>{asset.name}</td>
                      <td>{asset.category}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            background: getConditionColor(asset.condition),
                            color: "white",
                          }}
                        >
                          {asset.condition}
                        </span>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            background: getStatusColor(asset.status),
                            color: "white",
                          }}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td>
                        {asset.assignedDate
                          ? new Date(asset.assignedDate).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>
                        <button
                          className="btn btn-icon"
                          onClick={() => handleViewDetails(asset)}
                          title="View Details"
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asset Details - {selectedAsset.assetId}</h2>
              <button
                className="close-btn"
                onClick={() => setShowDetailModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Asset ID</span>
                  <span className="detail-value">{selectedAsset.assetId}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Name</span>
                  <span className="detail-value">{selectedAsset.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Category</span>
                  <span className="detail-value">{selectedAsset.category}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Condition</span>
                  <span
                    className="detail-value"
                    style={{ color: getConditionColor(selectedAsset.condition) }}
                  >
                    {selectedAsset.condition}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span
                    className="detail-value"
                    style={{ color: getStatusColor(selectedAsset.status) }}
                  >
                    {selectedAsset.status}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Assigned Date</span>
                  <span className="detail-value">
                    {selectedAsset.assignedDate
                      ? new Date(selectedAsset.assignedDate).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                {selectedAsset.issueDate && (
                  <div className="detail-item">
                    <span className="detail-label">Issue Date</span>
                    <span className="detail-value">
                      {new Date(selectedAsset.issueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedAsset.purchasePrice && (
                  <div className="detail-item">
                    <span className="detail-label">Purchase Price</span>
                    <span className="detail-value">
                      PKR {selectedAsset.purchasePrice.toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedAsset.notes && (
                  <div className="detail-item full-width">
                    <span className="detail-label">Notes</span>
                    <span className="detail-value">{selectedAsset.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', padding: '12px', background: '#dbeafe', borderRadius: '8px', color: '#1e40af' }}>
                ℹ️ If you notice any issues with this asset, please create a support ticket to report it to the IT department.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAssets;
