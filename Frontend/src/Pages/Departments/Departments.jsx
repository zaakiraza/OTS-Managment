import { useEffect, useState } from "react";
import { departmentAPI, employeeAPI } from "../../Config/Api";
import SideBar from "../../Components/SideBar/SideBar";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Departments.css";

const Departments = () => {
  const toast = useToast();
  const [departments, setDepartments] = useState([]); // Hierarchical data
  const [flatDepartments, setFlatDepartments] = useState([]); // Flat list for dropdowns
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'tree'
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    head: "",
    teamLead: "",
    parentDepartment: "",
    leverageTime: {
      checkInMinutes: 15,
      checkOutMinutes: 10,
    },
  });

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        setDepartments(response.data.data); // Hierarchical data
        setFlatDepartments(response.data.flatData || response.data.data); // Flat list for dropdowns
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (deptId) => {
    setExpandedDepts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deptId)) {
        newSet.delete(deptId);
      } else {
        newSet.add(deptId);
      }
      return newSet;
    });
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Remove empty fields if not provided
      const submitData = { ...formData };
      if (!submitData.head || submitData.head === "") {
        delete submitData.head;
      }
      if (!submitData.teamLead || submitData.teamLead === "") {
        delete submitData.teamLead;
      }
      if (!submitData.parentDepartment || submitData.parentDepartment === "") {
        submitData.parentDepartment = null;
      }
      
      let response;
      if (editMode) {
        response = await departmentAPI.update(editId, submitData);
      } else {
        response = await departmentAPI.create(submitData);
      }
      
      if (response.data.success) {
        setShowModal(false);
        setEditMode(false);
        setEditId(null);
        setFormData({ 
          name: "", 
          code: "", 
          description: "", 
          head: "",
          teamLead: "",
          parentDepartment: "",
          leverageTime: {
            checkInMinutes: 15,
            checkOutMinutes: 10,
          },
        });
        fetchDepartments();
        toast.success(editMode ? "Department updated successfully!" : "Department created successfully!");
      }
    } catch (error) {
      console.error("Error creating department:", error);
      toast.error(error.response?.data?.message || (editMode ? "Failed to update department" : "Failed to create department"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this department?")) return;
    try {
      await departmentAPI.delete(id);
      toast.success("Department deleted successfully!");
      fetchDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error(error.response?.data?.message || "Failed to delete department");
    }
  };

  const handleEdit = (dept) => {
    setEditMode(true);
    setEditId(dept._id);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      head: dept.head?._id || "",
      teamLead: dept.teamLead?._id || "",
      parentDepartment: dept.parentDepartment?._id || "",
      leverageTime: {
        checkInMinutes: dept.leverageTime?.checkInMinutes ?? 15,
        checkOutMinutes: dept.leverageTime?.checkOutMinutes ?? 10,
      },
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditId(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      head: "",
      teamLead: "",
      parentDepartment: "",
      leverageTime: {
        checkInMinutes: 15,
        checkOutMinutes: 10,
      },
    });
  };

  // Get parent department name by ID
  const getParentName = (parentDept) => {
    if (!parentDept) return null;
    if (typeof parentDept === 'object') return parentDept.name;
    const parent = flatDepartments.find(d => d._id === parentDept);
    return parent?.name || null;
  };

  // Department Card for Grid View
  const DepartmentGridCard = ({ dept }) => {
    const hasChildren = dept.children && dept.children.length > 0;
    const parentName = getParentName(dept.parentDepartment);

    return (
      <div className={`department-card ${dept.level > 0 ? 'sub-department' : 'root-department'}`}>
        <div className="dept-header">
          <div className="dept-title-row">
            <h3>{dept.name}</h3>
            <span className="dept-code">{dept.code}</span>
          </div>
        </div>
        {parentName && (
          <div className="parent-info">
            <i className="fas fa-folder-tree"></i> Under: <strong>{parentName}</strong>
          </div>
        )}
        <p className="dept-description">{dept.description || "No description"}</p>
        <div className="dept-info">
          <span className="leverage-info">
            <i className="fas fa-clock"></i> Grace: Check-in {dept.leverageTime?.checkInMinutes ?? 15}min | Check-out {dept.leverageTime?.checkOutMinutes ?? 10}min
          </span>
        </div>
        <div className="dept-team-info">
          <span className="info-item"><i className="fas fa-user-tie"></i> Head: {dept.head?.name || "Not assigned"}</span>
          <span className="info-item"><i className="fas fa-star"></i> Team Lead: {dept.teamLead?.name || "Not assigned"}</span>
        </div>
        {hasChildren && (
          <div className="children-count">
            <i className="fas fa-layer-group"></i> {dept.children.length} Sub-department{dept.children.length > 1 ? 's' : ''}
          </div>
        )}
        <div className="dept-footer">
          <div className="dept-actions">
            <button className="btn-edit" onClick={() => handleEdit(dept)}>
              Edit
            </button>
            <button className="btn-delete" onClick={() => handleDelete(dept._id)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Recursive Tree Node Component
  const TreeNode = ({ dept, level = 0 }) => {
    const hasChildren = dept.children && dept.children.length > 0;
    const isExpanded = expandedDepts.has(dept._id);
    const deptEmployees = employees.filter(emp => emp.department?._id === dept._id);
    const hasEmployees = deptEmployees.length > 0;

    return (
      <div className="tree-node">
        <div className={`tree-node-content level-${level}`}>
          <div className="tree-node-line" onClick={() => toggleExpand(dept._id)} style={{ cursor: 'pointer' }}>
            {(hasChildren || hasEmployees) && (
              <button 
                className="tree-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(dept._id);
                }}
              >
                <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
              </button>
            )}
            {!hasChildren && !hasEmployees && <span className="tree-leaf-icon"><i className="fas fa-circle" style={{fontSize: '6px'}}></i></span>}
            <div className={`tree-node-box ${level === 0 ? 'root-node' : 'child-node'}`}>
              <span className="tree-node-name">{dept.name}</span>
              <span className="tree-node-code">{dept.code}</span>
              {hasEmployees && (
                <span className="tree-node-count" style={{ marginLeft: '10px', fontSize: '12px', opacity: 0.7 }}>
                  <i className="fas fa-users"></i> {deptEmployees.length}
                </span>
              )}
            </div>
          </div>
        </div>
        {isExpanded && (
          <div className="tree-children">
            {/* Show employees first */}
            {hasEmployees && (
              <div className="tree-employees-list" style={{ marginLeft: level === 0 ? '60px' : '40px', marginBottom: '10px' }}>
                {deptEmployees.map((emp) => (
                  <div key={emp._id} className="tree-employee-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    marginBottom: '8px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <div className="tree-emp-avatar" style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      marginRight: '12px'
                    }}>
                      {emp.name?.charAt(0).toUpperCase() || 'E'}
                    </div>
                    <div className="tree-emp-info" style={{ flex: 1 }}>
                      <div className="tree-emp-name" style={{ fontWeight: '600', fontSize: '14px' }}>{emp.name}</div>
                      <div className="tree-emp-details" style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        <span style={{ marginRight: '10px' }}>{emp.employeeId}</span>
                        <span style={{ marginRight: '10px' }}>{emp.position}</span>
                        {emp.isTeamLead && <span style={{ color: '#f59e0b' }}><i className="fas fa-star"></i> Team Lead</span>}
                      </div>
                    </div>
                    <div className="tree-emp-actions">
                      <button 
                        className="btn-edit-small" 
                        onClick={(e) => { e.stopPropagation(); handleEdit(dept); }}
                        style={{
                          padding: '6px 10px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px'
                        }}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button 
                        className="btn-delete-small" 
                        onClick={(e) => { e.stopPropagation(); handleDelete(dept._id); }}
                        style={{
                          padding: '6px 10px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Then show children departments */}
            {hasChildren && dept.children.map((child) => (
              <TreeNode key={child._id} dept={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Expand all tree nodes
  const expandAll = () => {
    const allIds = new Set();
    const collectIds = (depts) => {
      depts.forEach(d => {
        if (d.children && d.children.length > 0) {
          allIds.add(d._id);
          collectIds(d.children);
        }
      });
    };
    collectIds(departments);
    setExpandedDepts(allIds);
  };

  // Collapse all tree nodes
  const collapseAll = () => {
    setExpandedDepts(new Set());
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="departments-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-building"></i>
              </div>
              <div>
                <h1>Departments</h1>
                <p>Manage organizational structure</p>
              </div>
            </div>
            <div className="header-actions">
              <div className="view-toggle">
                <button 
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <i className="fas fa-th"></i> Grid
                </button>
                <button 
                  className={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
                  onClick={() => setViewMode('tree')}
                  title="Tree View"
                >
                  <i className="fas fa-sitemap"></i> Tree
                </button>
              </div>
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                + Add Department
              </button>
            </div>
          </div>

          {loading && flatDepartments.length === 0 ? (
            <div className="loading">Loading...</div>
          ) : viewMode === 'grid' ? (
            <div className="departments-grid">
              {flatDepartments.map((dept) => (
                <DepartmentGridCard key={dept._id} dept={dept} />
              ))}
            </div>
          ) : (
            <div className="tree-view-container">
              <div className="tree-controls">
                <button className="tree-control-btn" onClick={expandAll}>
                  <i className="fas fa-expand-arrows-alt"></i> Expand All
                </button>
                <button className="tree-control-btn" onClick={collapseAll}>
                  <i className="fas fa-compress-arrows-alt"></i> Collapse All
                </button>
              </div>
              <div className="organization-tree">
                <div className="tree-header">
                  <h3><i className="fas fa-sitemap"></i> Organization Structure</h3>
                </div>
                <div className="tree-body">
                  {departments.map((dept) => (
                    <TreeNode key={dept._id} dept={dept} level={0} />
                  ))}
                </div>
              </div>
            </div>
          )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className={editMode ? "fas fa-edit" : "fas fa-plus-circle"}></i>
                {editMode ? " Edit Department" : " Add Department"}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-section-title">
                <i className="fas fa-info-circle"></i> Basic Information
              </div>
              
              <div className="form-group">
                <label><i className="fas fa-building"></i> Department Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Human Resources, Information Technology"
                  required
                />
              </div>
              <div className="form-group">
                <label><i className="fas fa-code"></i> Department Code <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., HR, IT, FIN"
                  required
                  maxLength={5}
                  disabled={editMode}
                  style={editMode ? { background: 'linear-gradient(to right, #e0f2f4, #f5f5f5)', cursor: 'not-allowed' } : {}}
                />
                <small className={editMode ? "helper-text info" : "helper-text"}>
                  {editMode ? <><i className="fas fa-lock"></i> Department code cannot be changed</> : "2-5 uppercase letters (auto-converted)"}
                </small>
              </div>
              <div className="form-group">
                <label><i className="fas fa-align-left"></i> Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  placeholder="Brief description of the department's responsibilities..."
                />
              </div>
              
              <div className="form-section-title">
                <i className="fas fa-sitemap"></i> Hierarchy
              </div>
              <div className="form-group">
                <label><i className="fas fa-level-up-alt"></i> Parent Department</label>
                <select
                  value={formData.parentDepartment}
                  onChange={(e) =>
                    setFormData({ ...formData, parentDepartment: e.target.value })
                  }
                >
                  <option value="">None (Root Department)</option>
                  {flatDepartments
                    .filter(d => d._id !== editId) // Can't be parent of itself
                    .map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {"—".repeat(dept.level || 0)} {dept.name} ({dept.code})
                      </option>
                    ))}
                </select>
                <small className="helper-text info">
                  <i className="fas fa-lightbulb"></i> 
                  {flatDepartments.length === 0 
                    ? " No departments available. Create your first root department."
                    : " Select 'None' to create a root department, or select OTS Studio to create under it."}
                </small>
              </div>
              
              <div className="form-section-title">
                <i className="fas fa-user-tie"></i> Team Lead Assignment
              </div>
              <div className="form-group">
                <label><i className="fas fa-star"></i> Team Lead</label>
                <select
                  value={formData.teamLead}
                  onChange={(e) =>
                    setFormData({ ...formData, teamLead: e.target.value })
                  }
                  disabled={!editMode}
                  style={!editMode ? { background: 'linear-gradient(to right, #e0f2f4, #f5f5f5)', cursor: 'not-allowed' } : {}}
                >
                  <option value="">Select Team Lead</option>
                  {editMode ? (
                    (() => {
                      const dept = departments.find(d => d._id === editId);
                      const deptEmployees = employees.filter(emp => {
                        if (!dept) return false;
                        const empDeptId = emp.department?._id || emp.department;
                        const deptId = dept._id;
                        return empDeptId === deptId || String(empDeptId) === String(deptId);
                      });
                      
                      // If no employees in department, show all employees
                      const listToShow = deptEmployees.length > 0 ? deptEmployees : employees;
                      
                      return listToShow.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.employeeId}) - {emp.position}
                        </option>
                      ));
                    })()
                  ) : (
                    <option value="" disabled>Create department first</option>
                  )}
                </select>
                <small className={editMode ? "helper-text" : "helper-text warning"}>
                  {editMode 
                    ? <><i className="fas fa-info-circle"></i> Team leads from this department are prioritized</> 
                    : <><i className="fas fa-exclamation-triangle"></i> Create department first, then edit to assign team lead</>}
                </small>
              </div>
              
              <div className="form-section-title">
                <i className="fas fa-clock"></i> Attendance Grace Period
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label><i className="fas fa-sign-in-alt"></i> Check-in Grace <span className="required">*</span></label>
                  <input
                    type="number"
                    value={formData.leverageTime.checkInMinutes}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        leverageTime: { 
                          ...formData.leverageTime, 
                          checkInMinutes: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                    min="0"
                    required
                  />
                  <small className="helper-text">Minutes allowed after scheduled check-in</small>
                </div>
                <div className="form-group">
                  <label><i className="fas fa-sign-out-alt"></i> Check-out Grace <span className="required">*</span></label>
                  <input
                    type="number"
                    value={formData.leverageTime.checkOutMinutes}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        leverageTime: { 
                          ...formData.leverageTime, 
                          checkOutMinutes: parseInt(e.target.value) || 0 
                        } 
                      })
                    }
                    min="0"
                    required
                  />
                  <small className="helper-text">Minutes allowed before scheduled check-out</small>
                </div>
              </div>
              
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  <i className="fas fa-times"></i> Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  <i className={loading ? "fas fa-spinner fa-spin" : (editMode ? "fas fa-save" : "fas fa-plus")}></i>
                  {loading ? (editMode ? " Updating..." : " Creating...") : (editMode ? " Update Department" : " Create Department")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Departments;
