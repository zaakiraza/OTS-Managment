import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import api from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./EmailTemplates.css";

function EmailTemplates() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [emailSettings, setEmailSettings] = useState({
    emailService: "gmail",
    emailUser: "",
    emailPassword: "",
    emailFromName: "OMS - Organization Management System",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchEmailSettings();
  }, []);

  const fetchEmailSettings = async () => {
    try {
      const response = await api.get("/settings");
      const settings = response.data.settings || [];
      
      const settingsObj = {};
      settings.forEach(setting => {
        if (['emailService', 'emailUser', 'emailPassword', 'emailFromName'].includes(setting.key)) {
          settingsObj[setting.key] = setting.value;
        }
      });
      
      setEmailSettings(prev => ({
        ...prev,
        ...settingsObj
      }));
    } catch (error) {
      console.error("Error fetching email settings:", error);
    }
  };

  const handleSaveEmailSettings = async () => {
    try {
      setSavingSettings(true);
      
      const settingsArray = [
        { key: "emailService", value: emailSettings.emailService },
        { key: "emailUser", value: emailSettings.emailUser },
        { key: "emailPassword", value: emailSettings.emailPassword },
        { key: "emailFromName", value: emailSettings.emailFromName },
      ];

      await api.put("/settings/bulk", { settings: settingsArray });
      toast.success("Email settings saved successfully!");
      setShowSettings(false);
    } catch (error) {
      toast.error("Failed to save email settings");
      console.error("Error saving settings:", error);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get("/email-templates");
      setTemplates(response.data.templates);
    } catch (error) {
      toast.error("Failed to load email templates");
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (template) => {
    try {
      setSelectedTemplate(template);
      const response = await api.get(`/email-templates/preview/${template.id}`);
      setPreviewHtml(response.data.html);
    } catch (error) {
      toast.error("Failed to load template preview");
      console.error("Error loading preview:", error);
    }
  };

  const handleSendTest = async (templateId) => {
    const email = prompt("Enter email address to send test email:");
    if (!email) return;

    try {
      await api.post(`/email-templates/send-test/${templateId}`, { email });
      toast.success(`Test email sent to ${email}`);
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to send test email";
      const errorHint = error.response?.data?.hint;
      
      if (errorHint) {
        toast.error(`${errorMessage}\n\n${errorHint}`);
      } else {
        toast.error(errorMessage);
      }
      console.error("Error sending test:", error);
    }
  };

  const templatesList = [
    {
      id: "task-assigned",
      name: "Task Assigned",
      description: "Notification sent when a task is assigned to an employee",
      icon: "📋",
      category: "Tasks"
    },
    {
      id: "ticket-created",
      name: "Ticket Created Against",
      description: "Notification when a ticket is reported against an employee",
      icon: "🎫",
      category: "Tickets"
    },
    {
      id: "ticket-resolved",
      name: "Ticket Resolved",
      description: "Notification when a ticket is resolved",
      icon: "✅",
      category: "Tickets"
    },
    {
      id: "task-status-change",
      name: "Task Status Change",
      description: "Notification when task status is updated",
      icon: "🔄",
      category: "Tasks"
    },
    {
      id: "ticket-comment",
      name: "Ticket Comment",
      description: "Notification when someone comments on a ticket",
      icon: "💬",
      category: "Tickets"
    },
    {
      id: "password-changed",
      name: "Password Changed",
      description: "Security notification when password is changed",
      icon: "🔒",
      category: "Security"
    },
    {
      id: "team-lead-assignment",
      name: "Team Lead Assignment",
      description: "Notification when assigned as team lead",
      icon: "👔",
      category: "Organization"
    },
    {
      id: "employee-created",
      name: "Employee Created",
      description: "Welcome email when new employee account is created",
      icon: "👋",
      category: "Organization"
    }
  ];

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="email-templates-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-envelope-open-text"></i>
              </div>
              <div>
                <h1>Email Templates</h1>
                <p>Preview and test all system email notifications</p>
              </div>
            </div>
            <button 
              className="btn-secondary" 
              onClick={() => setShowSettings(true)}
              style={{ marginLeft: 'auto' }}
            >
              <i className="fas fa-cog"></i> Email Settings
            </button>
          </div>

          <div className="templates-layout">
        {/* Templates List */}
        <div className="templates-list">
          <div className="list-header">
            <h2>Available Templates</h2>
            <span className="template-count">{templatesList.length} templates</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading templates...</p>
            </div>
          ) : (
            <div className="template-cards">
              {templatesList.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate?.id === template.id ? "active" : ""}`}
                  onClick={() => handlePreview(template)}
                >
                  <div className="template-icon">{template.icon}</div>
                  <div className="template-info">
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                    <span className="template-category">{template.category}</span>
                  </div>
                  <button
                    className="preview-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(template);
                    }}
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="preview-panel">
          {selectedTemplate ? (
            <>
              <div className="preview-header">
                <div className="preview-title">
                  <span className="preview-icon">{selectedTemplate.icon}</span>
                  <div>
                    <h2>{selectedTemplate.name}</h2>
                    <p>{selectedTemplate.description}</p>
                  </div>
                </div>
                <div className="preview-actions">
                  <button
                    className="test-email-btn"
                    onClick={() => handleSendTest(selectedTemplate.id)}
                  >
                    <i className="fas fa-paper-plane"></i>
                    Send Test Email
                  </button>
                  <button
                    className="close-preview-btn"
                    onClick={() => setSelectedTemplate(null)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              <div className="preview-content">
                {previewHtml ? (
                  <iframe
                    title="Email Template Preview"
                    srcDoc={previewHtml}
                    className="email-preview-iframe"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="preview-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <p>Loading preview...</p>
                  </div>
                )}
              </div>

              <div className="preview-footer">
                <div className="theme-info">
                  <span className="theme-badge">
                    <span className="color-dot" style={{ background: "linear-gradient(135deg, #093635 0%, #1F6A75 100%)" }}></span>
                    OMS Theme
                  </span>
                  <span className="theme-badge">
                    <span className="color-dot" style={{ background: "linear-gradient(135deg, #F49040 0%, #EE8939 100%)" }}></span>
                    Accent Color
                  </span>
                </div>
                <p className="preview-note">
                  <i className="fas fa-info-circle"></i>
                  This is a live preview with sample data
                </p>
              </div>
            </>
          ) : (
            <div className="no-preview">
              <div className="no-preview-icon">
                <i className="fas fa-envelope-open-text"></i>
              </div>
              <h3>No Template Selected</h3>
              <p>Select a template from the list to preview its design and content</p>
            </div>
          )}
        </div>
      </div>

        {/* Email Settings Modal */}
        {showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h2><i className="fas fa-envelope-open-text"></i> Email Configuration</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="modal-body">
                <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '14px' }}>
                  Configure email service credentials for sending system notifications. These settings are stored securely in the database.
                </p>

                <div className="form-group">
                  <label>Email Service Provider</label>
                  <select
                    value={emailSettings.emailService}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailService: e.target.value })}
                    className="form-control"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="yahoo">Yahoo Mail</option>
                    <option value="zoho">Zoho Mail</option>
                  </select>
                  <small className="form-hint">Select your email service provider</small>
                </div>

                <div className="form-group">
                  <label>Email Address <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="email"
                    value={emailSettings.emailUser}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailUser: e.target.value })}
                    placeholder="your-email@example.com"
                    className="form-control"
                  />
                  <small className="form-hint">The email address from which notifications will be sent</small>
                </div>

                <div className="form-group">
                  <label>Email Password / App Password <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    type="password"
                    value={emailSettings.emailPassword}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailPassword: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="form-control"
                  />
                  <small className="form-hint">
                    <i className="fas fa-info-circle"></i> For Gmail, use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" style={{ color: '#1F6A75', textDecoration: 'underline' }}>App Password</a> instead of your regular password
                  </small>
                </div>

                <div className="form-group">
                  <label>Sender Name</label>
                  <input
                    type="text"
                    value={emailSettings.emailFromName}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailFromName: e.target.value })}
                    placeholder="OMS - Organization Management System"
                    className="form-control"
                  />
                  <small className="form-hint">The name that will appear as the sender in emails</small>
                </div>

                <div style={{ background: 'linear-gradient(135deg, rgba(9, 54, 53, 0.05) 0%, rgba(31, 106, 117, 0.05) 100%)', borderLeft: '4px solid #1F6A75', borderRadius: '8px', padding: '15px', marginTop: '20px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                    <i className="fas fa-shield-alt" style={{ color: '#1F6A75', marginRight: '8px' }}></i>
                    <strong>Security Note:</strong> Your credentials are encrypted and stored securely in the database. They will only be used for sending system email notifications.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowSettings(false)}
                  disabled={savingSettings}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveEmailSettings}
                  disabled={savingSettings || !emailSettings.emailUser || !emailSettings.emailPassword}
                >
                  {savingSettings ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i> Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default EmailTemplates;
