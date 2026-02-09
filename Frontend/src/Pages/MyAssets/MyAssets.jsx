import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { assetAPI } from "../../Config/Api";
import "./MyAssets.css";

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
      const user = (() => {
        try {
          const stored = localStorage.getItem("user");
          if (!stored || stored === "undefined") return {};
          return JSON.parse(stored);
        } catch { return {}; }
      })();
      
      // Use the getEmployeeAssets endpoint instead
      const response = await assetAPI.getEmployeeAssets(user._id);
      
      if (response.data.success) {
        setAssets(response.data.data);
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
      Excellent: "#059669",
      Good: "#10b981",
      Fair: "#f59e0b",
      Poor: "#ef4444",
    };
    return colors[condition] || "#999";
  };

  const getCategoryIcon = (category) => {
    const icons = {
      Laptop: "fa-laptop",
      Desktop: "fa-desktop",
      Monitor: "fa-tv",
      Keyboard: "fa-keyboard",
      Mouse: "fa-mouse",
      Headphones: "fa-headphones",
      "Cable/Wire": "fa-ethernet",
      "Router/Switch": "fa-network-wired",
      Printer: "fa-print",
      Scanner: "fa-scanner",
      Webcam: "fa-video",
      "Hard Drive": "fa-hdd",
      RAM: "fa-memory",
      Other: "fa-box",
    };
    return icons[category] || "fa-box";
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="my-assets-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-laptop-house"></i>
              </div>
              <div>
                <h1>My Assets</h1>
                <p>View IT assets assigned to you</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-row">
            <div className="stat-card total">
              <div className="stat-icon">
                <i className="fas fa-boxes"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Assets</span>
                <span className="stat-value">{assets.length}</span>
              </div>
            </div>
            <div className="stat-card good">
              <div className="stat-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Good Condition</span>
                <span className="stat-value">
                  {assets.filter((a) => a.condition === "Good" || a.condition === "Excellent").length}
                </span>
              </div>
            </div>
            <div className="stat-card attention">
              <div className="stat-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div className="stat-info">
                <span className="stat-label">Needs Attention</span>
                <span className="stat-value">
                  {assets.filter((a) => a.condition === "Fair" || a.condition === "Poor").length}
                </span>
              </div>
            </div>
          </div>

          {/* Assets Grid */}
          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin"></i>
              <span>Loading your assets...</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="fas fa-box-open"></i>
              </div>
              <h3>No Assets Assigned</h3>
              <p>You don't have any IT assets assigned to you yet.</p>
            </div>
          ) : (
            <div className="assets-grid">
              {assets.map((asset) => (
                <div key={asset._id} className="asset-card" onClick={() => handleViewDetails(asset)}>
                  <div className="asset-card-header">
                    <div className="asset-image-wrapper">
                      {asset.images && asset.images.length > 0 ? (
                        <img src={asset.images[0]} alt={asset.name} className="asset-image" />
                      ) : (
                        <div className="asset-placeholder">
                          <i className={`fas ${getCategoryIcon(asset.category)}`}></i>
                        </div>
                      )}
                    </div>
                    <div className="asset-badges">
                      <span className="condition-badge" style={{ background: getConditionColor(asset.condition) }}>
                        {asset.condition}
                      </span>
                    </div>
                  </div>
                  
                  <div className="asset-card-body">
                    <div className="asset-id-tag">{asset.assetId}</div>
                    <h3 className="asset-name">{asset.name}</h3>
                    <span className="asset-category">
                      <i className={`fas ${getCategoryIcon(asset.category)}`}></i>
                      {asset.category}
                    </span>
                    
                    <div className="asset-details-preview">
                      {asset.serialNumber && (
                        <div className="detail-row">
                          <i className="fas fa-barcode"></i>
                          <span>{asset.serialNumber}</span>
                        </div>
                      )}
                      {asset.location?.building && (
                        <div className="detail-row">
                          <i className="fas fa-building"></i>
                          <span>{asset.location.building}{asset.location.floor ? `, ${asset.location.floor}` : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="asset-card-footer">
                    <span className="assigned-date">
                      <i className="fas fa-calendar-check"></i>
                      Assigned: {asset.assignedDate ? new Date(asset.assignedDate).toLocaleDateString() : 'N/A'}
                    </span>
                    <button className="btn-view-details">
                      <i className="fas fa-eye"></i> View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="asset-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fas fa-laptop"></i>
                <span>Asset Details</span>
              </div>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              {/* Asset Image & Basic Info */}
              <div className="asset-hero">
                <div className="asset-hero-image">
                  {selectedAsset.images && selectedAsset.images.length > 0 ? (
                    <img src={selectedAsset.images[0]} alt={selectedAsset.name} />
                  ) : (
                    <div className="hero-placeholder">
                      <i className={`fas ${getCategoryIcon(selectedAsset.category)}`}></i>
                    </div>
                  )}
                </div>
                <div className="asset-hero-info">
                  <span className="hero-asset-id">{selectedAsset.assetId}</span>
                  <h2 className="hero-asset-name">{selectedAsset.name}</h2>
                  <div className="hero-badges">
                    <span className="badge category-badge">
                      <i className={`fas ${getCategoryIcon(selectedAsset.category)}`}></i>
                      {selectedAsset.category}
                    </span>
                    <span className="badge condition-badge" style={{ background: getConditionColor(selectedAsset.condition) }}>
                      {selectedAsset.condition}
                    </span>
                    <span className="badge status-badge" style={{ background: getStatusColor(selectedAsset.status) }}>
                      {selectedAsset.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="details-section">
                <h4 className="section-title">
                  <i className="fas fa-info-circle"></i> Asset Information
                </h4>
                <div className="details-grid">
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-fingerprint"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Asset ID</span>
                      <span className="detail-value">{selectedAsset.assetId}</span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-tag"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Name</span>
                      <span className="detail-value">{selectedAsset.name}</span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-th-large"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Category</span>
                      <span className="detail-value">{selectedAsset.category}</span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-barcode"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Serial Number</span>
                      <span className="detail-value">{selectedAsset.serialNumber || '—'}</span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-network-wired"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">MAC Address</span>
                      <span className="detail-value mac">{selectedAsset.macAddress || '—'}</span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-heartbeat"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Condition</span>
                      <span className="detail-value" style={{ color: getConditionColor(selectedAsset.condition) }}>
                        {selectedAsset.condition}
                      </span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-toggle-on"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Status</span>
                      <span className="detail-value" style={{ color: getStatusColor(selectedAsset.status) }}>
                        {selectedAsset.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-calendar-alt"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Issue Date</span>
                      <span className="detail-value">
                        {selectedAsset.issueDate ? new Date(selectedAsset.issueDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Section */}
              {(selectedAsset.location?.building || selectedAsset.location?.floor) && (
                <div className="details-section">
                  <h4 className="section-title">
                    <i className="fas fa-map-marker-alt"></i> Location
                  </h4>
                  <div className="details-grid">
                    <div className="detail-card">
                      <div className="detail-icon"><i className="fas fa-building"></i></div>
                      <div className="detail-content">
                        <span className="detail-label">Building</span>
                        <span className="detail-value">{selectedAsset.location?.building || '—'}</span>
                      </div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-icon"><i className="fas fa-layer-group"></i></div>
                      <div className="detail-content">
                        <span className="detail-label">Floor</span>
                        <span className="detail-value">{selectedAsset.location?.floor || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment & Financial Section */}
              <div className="details-section">
                <h4 className="section-title">
                  <i className="fas fa-user-check"></i> Assignment Details
                </h4>
                <div className="details-grid">
                  <div className="detail-card">
                    <div className="detail-icon"><i className="fas fa-calendar-check"></i></div>
                    <div className="detail-content">
                      <span className="detail-label">Assigned Date</span>
                      <span className="detail-value">
                        {selectedAsset.assignedDate ? new Date(selectedAsset.assignedDate).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                  {selectedAsset.purchasePrice && (
                    <div className="detail-card">
                      <div className="detail-icon"><i className="fas fa-money-bill-wave"></i></div>
                      <div className="detail-content">
                        <span className="detail-label">Purchase Price</span>
                        <span className="detail-value">PKR {selectedAsset.purchasePrice.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              {selectedAsset.notes && (
                <div className="details-section">
                  <h4 className="section-title">
                    <i className="fas fa-sticky-note"></i> Notes
                  </h4>
                  <div className="notes-box">
                    {selectedAsset.notes}
                  </div>
                </div>
              )}

              {/* Info Banner */}
              <div className="info-banner">
                <i className="fas fa-info-circle"></i>
                <span>If you notice any issues with this asset, please create a support ticket to report it to the IT department.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyAssets;
