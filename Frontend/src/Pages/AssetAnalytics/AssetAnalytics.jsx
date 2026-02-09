import React, { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { assetAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./AssetAnalytics.css";
import * as XLSX from "xlsx";

const AssetAnalytics = () => {
  const toast = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatLabel = (value) => {
    if (!value) return "Unknown";
    return String(value)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await assetAPI.getAnalytics();
      if (response.data?.success) {
        setAnalytics(response.data.data);
      } else {
        setAnalytics(null);
      }
    } catch (error) {
      toast.error("Failed to load analytics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalyticsToExcel = () => {
    if (!analytics) {
      toast.error("No analytics data to export");
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.json_to_sheet([
        {
          "Total Quantity": analytics.summary?.totalQuantity || 0,
          "Assigned Quantity": analytics.summary?.totalAssignedQty || 0,
          "Available Quantity": analytics.summary?.availableQty || 0,
          "Asset Count": analytics.summary?.assetCount || 0,
        },
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      const statusSheet = XLSX.utils.json_to_sheet(
        (analytics.assetsByStatus || []).map((item) => ({
          Status: formatLabel(item._id),
          Count: item.count || 0,
          Quantity: item.quantity || 0,
          Percentage:
            analytics.summary?.totalQuantity > 0
              ? `${((item.quantity / analytics.summary.totalQuantity) * 100).toFixed(1)}%`
              : "0%",
        }))
      );
      XLSX.utils.book_append_sheet(workbook, statusSheet, "By Status");

      const categorySheet = XLSX.utils.json_to_sheet(
        (analytics.assetsByCategory || []).map((item) => ({
          Category: formatLabel(item._id),
          Count: item.count || 0,
          Quantity: item.quantity || 0,
          Percentage:
            analytics.summary?.totalQuantity > 0
              ? `${((item.quantity / analytics.summary.totalQuantity) * 100).toFixed(1)}%`
              : "0%",
        }))
      );
      XLSX.utils.book_append_sheet(workbook, categorySheet, "By Category");

      const employeeSheet = XLSX.utils.json_to_sheet(
        (analytics.employeeAssignments || []).map((emp) => ({
          "Employee ID": emp.employeeId || "",
          "Employee Name": emp.employeeName || "",
          Email: emp.employeeEmail || "",
          "Total Assigned": emp.totalAssigned || 0,
          "Items Count": emp.itemsCount || 0,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, employeeSheet, "Top Employees");

      const topAssetsSheet = XLSX.utils.json_to_sheet(
        (analytics.topAssignedAssets || []).map((asset) => ({
          "Asset ID": asset.assetId || "",
          "Asset Name": asset.name || "",
          Category: formatLabel(asset.category),
          "Total Quantity": asset.quantity || 0,
          "Assigned Quantity": asset.quantityAssigned || 0,
          Available: asset.available ?? 0,
          "Assignment %":
            asset.quantity > 0
              ? `${((asset.quantityAssigned / asset.quantity) * 100).toFixed(0)}%`
              : "0%",
        }))
      );
      XLSX.utils.book_append_sheet(workbook, topAssetsSheet, "Top Assets");

      XLSX.writeFile(workbook, "Asset_Analytics_Report.xlsx");
      toast.success("Analytics exported successfully");
    } catch (error) {
      console.error("Export analytics error:", error);
      toast.error("Failed to export analytics");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <SideBar />
        <div className="main-content">
          <div className="analytics-container">
            <div className="analytics-loading">Loading analytics...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="dashboard-layout">
        <SideBar />
        <div className="main-content">
          <div className="analytics-container">
            <div className="analytics-error">Failed to load analytics data</div>
          </div>
        </div>
      </div>
    );
  }

  const { summary, assetsByStatus, assetsByCategory, employeeAssignments, topAssignedAssets } = analytics;

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="analytics-container">
          <h1>Asset Analytics Dashboard</h1>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card total">
          <div className="card-label">Total Quantity</div>
          <div className="card-value">{summary.totalQuantity}</div>
          <div className="card-subtext">{summary.assetCount} Assets</div>
        </div>

        <div className="summary-card available">
          <div className="card-label">Available Quantity</div>
          <div className="card-value">{summary.availableQty}</div>
          <div className="card-subtext">{((summary.availableQty / summary.totalQuantity) * 100 || 0).toFixed(1)}%</div>
        </div>

        <div className="summary-card assigned">
          <div className="card-label">Assigned Quantity</div>
          <div className="card-value">{summary.totalAssignedQty}</div>
          <div className="card-subtext">{((summary.totalAssignedQty / summary.totalQuantity) * 100 || 0).toFixed(1)}%</div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="analytics-grid">
        <div className="analytics-card">
          <h2>Assets by Status</h2>
          <div className="status-breakdown">
            {assetsByStatus && assetsByStatus.length > 0 ? (
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Quantity</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsByStatus.map((item) => {
                    const statusClass = item._id
                      ? item._id.toLowerCase().replace(/\s+/g, "-")
                      : "unknown";
                    return (
                      <tr key={item._id}>
                        <td className="status-cell">
                          <span className={`status-badge status-${statusClass}`}>
                            {formatLabel(item._id)}
                          </span>
                        </td>
                      <td>{item.count}</td>
                      <td>{item.quantity}</td>
                      <td>{((item.quantity / summary.totalQuantity) * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p>No data available</p>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="analytics-card">
          <h2>Assets by Category</h2>
          <div className="category-breakdown">
            {assetsByCategory && assetsByCategory.length > 0 ? (
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Count</th>
                    <th>Quantity</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {assetsByCategory.map((item) => (
                    <tr key={item._id}>
                      <td>{formatLabel(item._id)}</td>
                      <td>{item.count}</td>
                      <td>{item.quantity}</td>
                      <td>{((item.quantity / summary.totalQuantity) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Employee Distribution */}
      <div className="analytics-card full-width">
        <h2>Employee Asset Distribution (Top 10)</h2>
        <div className="employee-distribution">
          {employeeAssignments && employeeAssignments.length > 0 ? (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Email</th>
                  <th>Total Items Assigned</th>
                  <th>Items Count</th>
                </tr>
              </thead>
              <tbody>
                {employeeAssignments.slice(0, 10).map((emp, index) => (
                  <tr key={emp.employeeId || index} className="employee-row">
                    <td>{emp.employeeId}</td>
                    <td className="employee-name">{emp.employeeName}</td>
                    <td>{emp.employeeEmail}</td>
                    <td className="quantity-cell">{emp.totalAssigned}</td>
                    <td className="items-cell">{emp.itemsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No employee assignments</p>
          )}
        </div>
      </div>

      {/* Top Assigned Assets */}
      <div className="analytics-card full-width">
        <h2>Most Assigned Assets (Top 10)</h2>
        <div className="top-assets">
          {topAssignedAssets && topAssignedAssets.length > 0 ? (
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Total Quantity</th>
                  <th>Assigned Quantity</th>
                  <th>Available</th>
                  <th>Assignment %</th>
                </tr>
              </thead>
              <tbody>
                {topAssignedAssets.slice(0, 10).map((asset) => (
                  <tr key={asset._id} className="asset-row">
                    <td>{asset.assetId}</td>
                    <td className="asset-name">{asset.name}</td>
                    <td>{formatLabel(asset.category)}</td>
                    <td>{asset.quantity}</td>
                    <td className="assigned-qty">{asset.quantityAssigned}</td>
                    <td className="available-qty">{asset.available}</td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${((asset.quantityAssigned / asset.quantity) * 100) || 0}%`,
                          }}
                        ></div>
                        <span className="progress-text">
                          {((asset.quantityAssigned / asset.quantity) * 100 || 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No assigned assets</p>
          )}
        </div>
      </div>

          <div className="analytics-actions">
            <button className="export-btn" onClick={exportAnalyticsToExcel}>
              Export Excel
            </button>
            <button className="refresh-btn" onClick={fetchAnalytics}>
              Refresh Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetAnalytics;
