import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import api from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Settings.css";

function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get("/settings");
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const currentValue = settings[key]?.value;
    const newValue = !currentValue;

    try {
      setSaving(true);
      const response = await api.put("/settings", {
        key,
        value: newValue,
      });
      
      if (response.data.success) {
        setSettings((prev) => ({
          ...prev,
          [key]: { ...prev[key], value: newValue },
        }));
        toast.success("Setting updated successfully");
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      toast.error(error.response?.data?.message || "Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  const settingGroups = {
    "Attendance Settings": [
      {
        key: "manualAttendanceEnabled",
        label: "Manual Attendance Entry",
        description: "Allow attendance department to mark attendance manually",
        icon: "fa-hand-pointer",
      },
      {
        key: "importAttendanceEnabled",
        label: "Import Attendance",
        description: "Allow attendance department to import attendance data from files",
        icon: "fa-file-import",
      },
      {
        key: "autoMarkAbsentEnabled",
        label: "Auto Mark Absent",
        description: "Automatically mark employees as absent at end of day if no attendance recorded",
        icon: "fa-user-clock",
      },
    ],
    "System Settings": [
      {
        key: "lastProcessedAttendanceSN",
        label: "Last Processed Biometric SN",
        description: "Serial number of the last processed attendance record from biometric device",
        icon: "fa-fingerprint",
        type: "display",
      },
    ],
  };

  const renderSettingValue = (setting) => {
    const value = settings[setting.key]?.value;
    
    if (setting.type === "display") {
      const hasValue = value !== null && value !== undefined;
      return (
        <div className={`setting-display-value ${!hasValue ? 'not-set' : ''}`}>
          <span className="value-text">{hasValue ? value : "Not set"}</span>
        </div>
      );
    }

    return (
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={value || false}
          onChange={() => handleToggle(setting.key)}
          disabled={saving}
        />
        <span className="toggle-slider"></span>
      </label>
    );
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="settings-page">
          {/* Page Header */}
          <div className="page-header">
            <h1>System Settings</h1>
            <p>Configure system-wide settings and preferences</p>
          </div>

          {loading ? (
            <div className="loading-container">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading settings...</p>
            </div>
          ) : (
            <div className="settings-container">
              {Object.entries(settingGroups).map(([groupName, groupSettings]) => (
                <div key={groupName} className="settings-group">
                  <h2 className="group-title">{groupName}</h2>
                  <div className="settings-list">
                    {groupSettings.map((setting) => (
                      <div key={setting.key} className="setting-item">
                        <div className="setting-icon">
                          <i className={`fas ${setting.icon}`}></i>
                        </div>
                        <div className="setting-info">
                          <h3 className="setting-label">{setting.label}</h3>
                          <p className="setting-description">{setting.description}</p>
                        </div>
                        <div className="setting-control">
                          {renderSettingValue(setting)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
