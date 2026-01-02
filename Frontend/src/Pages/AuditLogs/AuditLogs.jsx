import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { auditLogAPI, exportAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./AuditLogs.css";

function AuditLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actions, setActions] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [filters, setFilters] = useState({
    action: "",
    resourceType: "",
    startDate: "",
    endDate: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });

  useEffect(() => {
    fetchLogs();
    fetchFilterOptions();
  }, [filters, pagination.page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };
      // Remove empty filters
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const response = await auditLogAPI.getAll(params);
      if (response.data.success) {
        setLogs(response.data.data);
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages,
        }));
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [actionsRes, resourceTypesRes] = await Promise.all([
        auditLogAPI.getActions(),
        auditLogAPI.getResourceTypes(),
      ]);
      if (actionsRes.data.success) setActions(actionsRes.data.data);
      if (resourceTypesRes.data.success) setResourceTypes(resourceTypesRes.data.data);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await exportAPI.exportAuditLogs('xlsx');
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export audit logs");
    } finally {
      setExporting(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const getActionBadge = (action) => {
    const colors = {
      CREATE: "#10b981",
      UPDATE: "#3b82f6",
      DELETE: "#ef4444",
      LOGIN: "#8b5cf6",
      LOGOUT: "#6b7280",
      PASSWORD_CHANGE: "#f59e0b",
      STATUS_CHANGE: "#06b6d4",
      EXPORT: "#ec4899",
    };
    return (
      <span
        className="action-badge"
        style={{ background: colors[action] || "#64748b" }}
      >
        {action}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const isSuccess = status === "success";
    return (
      <span className={`status-badge ${isSuccess ? "success" : "failed"}`}>
        {isSuccess ? <i className="fas fa-check"></i> : <i className="fas fa-times"></i>} {status}
      </span>
    );
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="audit-logs-page">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1><i className="fas fa-history"></i> Audit Logs</h1>
              <p className="page-subtitle">Track all system activities and changes</p>
            </div>
            <button
              className="btn-export"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? <><i className="fas fa-spinner fa-spin"></i> Exporting...</> : <><i className="fas fa-file-excel"></i> Export to Excel</>}
            </button>
          </div>

          {/* Filters */}
          <div className="filters-section">
            <div className="filter-group">
              <label>Action</label>
              <select
                value={filters.action}
                onChange={(e) =>
                  setFilters({ ...filters, action: e.target.value })
                }
              >
                <option value="">All Actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Resource Type</label>
              <select
                value={filters.resourceType}
                onChange={(e) =>
                  setFilters({ ...filters, resourceType: e.target.value })
                }
              >
                <option value="">All Types</option>
                {resourceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
              />
            </div>
            <div className="filter-group">
              <label>End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
              />
            </div>
            <button
              className="btn-clear"
              onClick={() =>
                setFilters({ action: "", resourceType: "", startDate: "", endDate: "" })
              }
            >
              Clear Filters
            </button>
          </div>

          {/* Logs Table */}
          <div className="logs-table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Description</th>
                  <th>Performed By</th>
                  <th>Role</th>
                  <th>IP Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="loading-cell">
                      Loading...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-cell">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id}>
                      <td className="timestamp">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td>
                        <span className="resource-type">{log.resourceType}</span>
                      </td>
                      <td className="description">{log.description}</td>
                      <td>
                        <span className="performed-by">{log.performedByName}</span>
                      </td>
                      <td>
                        <span className="role-badge">{log.performedByRole}</span>
                      </td>
                      <td className="ip-address">
                        {log.metadata?.ipAddress || "N/A"}
                      </td>
                      <td>{getStatusBadge(log.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {logs.length} of {pagination.total} logs
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <i className="fas fa-angle-left"></i>
                </button>
                <span className="pagination-current">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.pages)}
                  disabled={pagination.page === pagination.pages}
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;

