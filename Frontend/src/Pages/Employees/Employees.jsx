import { useEffect, useState } from "react";
import { employeeAPI, departmentAPI, roleAPI, exportAPI, authAPI } from "../../Config/Api";
import SideBar from "../../Components/SideBar/SideBar";
import { getStoredUser } from "../../Utils/storage";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Employees.css";

const Employees = () => {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [hierarchicalDepts, setHierarchicalDepts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedDept, setSelectedDept] = useState("");
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'tree'
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
    biometricId: "",
    department: "",
    additionalDepartments: [],
    leadingDepartments: [],
    position: "",
    salary: {
      monthlySalary: "",
      currency: "PKR",
      leaveThreshold: 0,
    },
    workSchedule: {
      checkInTime: "09:00",
      checkOutTime: "17:00",
      workingDaysPerWeek: 5,
      weeklyOffs: ["Saturday", "Sunday"],
      workingHoursPerWeek: 40,
    },
    joiningDate: "",
    password: "",
    isTeamLead: false,
    role: "",
  });

  useEffect(() => {
    // Fetch current user from API to ensure department is populated
    const fetchCurrentUser = async () => {
      try {
        const response = await authAPI.getMe();
        if (response.data.success) {
          setCurrentUser(response.data.data);
        } else {
          // Fallback to stored user if API fails
          const user = getStoredUser();
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
        // Fallback to stored user if API fails
        const user = getStoredUser();
        setCurrentUser(user);
      }
    };
    
    fetchCurrentUser();
    fetchEmployees();
    fetchDepartments();
    fetchRoles();
  }, []);

  // Auto-set department when modal opens and departments are loaded
  useEffect(() => {
    if (showModal && !editMode && currentUser && departments.length > 0) {
      // Only auto-set if department is not already set
      if (!formData.department || formData.department === "") {
        if (currentUser?.role?.name === "attendanceDepartment") {
          // Use assigned department or first available department
          let defaultDepartment = "";
          if (currentUser?.department) {
            defaultDepartment = String(currentUser.department._id || currentUser.department);
          } else {
            // Get filtered departments
            const filteredDepts = currentUser.role?.name !== "attendanceDepartment" 
              ? departments 
              : (() => {
                  if (!currentUser.department) return departments;
                  const userDeptId = String(currentUser.department._id || currentUser.department);
                  return departments.filter(dept => {
                    const deptId = String(dept._id);
                    const parentDeptId = dept.parentDepartment 
                      ? String(dept.parentDepartment._id || dept.parentDepartment) 
                      : null;
                    const deptPath = dept.path || "";
                    return deptId === userDeptId || 
                           parentDeptId === userDeptId || 
                           deptPath.includes(userDeptId);
                  });
                })();
            
            if (filteredDepts.length > 0) {
              defaultDepartment = String(filteredDepts[0]._id);
            }
          }
          
          if (defaultDepartment) {
            setFormData(prev => ({ ...prev, department: defaultDepartment }));
          }
        }
      }
    }
  }, [showModal, editMode, currentUser, departments, formData.department]);

  // Get filtered departments for Primary Department dropdown
  const getFilteredDepartments = () => {
    // For superAdmin and other roles, show all departments
    if (!currentUser || currentUser.role?.name !== "attendanceDepartment") {
      return departments;
    }
    
    // For attendanceDepartment users, only show departments they created
    // Filter by createdBy field to exclude parent departments that are returned by backend
    return departments.filter(dept => {
      const deptCreatedBy = dept.createdBy?._id || dept.createdBy;
      const currentUserId = currentUser._id;
      return String(deptCreatedBy) === String(currentUserId);
    });
  };

  // Get filtered departments for Additional Departments dropdown
  // Show siblings of selected Primary Department AND their children, but NOT children of Primary itself
  const getAdditionalDepartmentsOptions = () => {
    if (!formData.department) {
      return []; // No primary selected, don't show any additional departments
    }

    const primaryDeptId = String(formData.department);
    const primaryDept = departments.find(d => String(d._id) === primaryDeptId);
    
    if (!primaryDept) {
      return [];
    }

    // Get parent of primary department
    const primaryParentId = primaryDept.parentDepartment 
      ? String(primaryDept.parentDepartment._id || primaryDept.parentDepartment)
      : null;

    // First, collect all sibling department IDs
    const siblingIds = new Set();
    getFilteredDepartments().forEach(dept => {
      const deptId = String(dept._id);
      
      // Skip primary department itself
      if (deptId === primaryDeptId) {
        return;
      }

      const deptParentId = dept.parentDepartment 
        ? String(dept.parentDepartment._id || dept.parentDepartment)
        : null;

      // Add siblings (departments with same parent as primary)
      if (primaryParentId && deptParentId === primaryParentId) {
        siblingIds.add(deptId);
      }
    });

    // Filter departments to show:
    // 1. Siblings of primary (same parent)
    // 2. Children of siblings
    // 3. But NOT children of primary itself
    const availableDepts = getFilteredDepartments().filter(dept => {
      const deptId = String(dept._id);
      
      // Don't show primary department itself
      if (deptId === primaryDeptId) {
        return false;
      }

      const deptParentId = dept.parentDepartment 
        ? String(dept.parentDepartment._id || dept.parentDepartment)
        : null;

      // Check if it's a child of primary department
      const isChildOfPrimary = deptParentId === primaryDeptId || 
                               (dept.path && dept.path.includes(primaryDeptId));

      // Don't show children of primary
      if (isChildOfPrimary) {
        return false;
      }

      // Show if it's a sibling
      if (siblingIds.has(deptId)) {
        return true;
      }

      // Show if it's a child of any sibling
      if (deptParentId && siblingIds.has(deptParentId)) {
        return true;
      }

      // Show if it's a descendant of any sibling (check path)
      for (const siblingId of siblingIds) {
        if (dept.path && dept.path.includes(siblingId)) {
          return true;
        }
      }

      return false;
    });

    return availableDepts;
  };

  // Get filtered departments for Team Lead Of dropdown
  // Only show departments selected in Primary + Additional Departments
  const getTeamLeadOfOptions = () => {
    const selectedDeptIds = new Set();
    
    // Add primary department
    if (formData.department) {
      selectedDeptIds.add(String(formData.department));
      
      // Also add children of primary department
      const primaryDeptId = String(formData.department);
      getFilteredDepartments().forEach(dept => {
        const deptParentId = dept.parentDepartment 
          ? String(dept.parentDepartment._id || dept.parentDepartment)
          : null;
        
        // Check if it's a child of primary department
        if (deptParentId === primaryDeptId || 
            (dept.path && dept.path.includes(primaryDeptId))) {
          selectedDeptIds.add(String(dept._id));
        }
      });
    }
    
    // Add additional departments
    formData.additionalDepartments.forEach(deptId => {
      selectedDeptIds.add(String(deptId));
    });

    // Return only departments that are in selected set
    return getFilteredDepartments().filter(dept => 
      selectedDeptIds.has(String(dept._id))
    );
  };

  const fetchEmployees = async (deptId = "", page = 1, search = "") => {
    try {
      setLoading(true);
      const params = { page, limit: pagination.limit };
      if (deptId) params.department = deptId;
      if (search) params.search = search;
      
      const response = await employeeAPI.getAll(params);
      if (response.data.success) {
        setEmployees(response.data.data);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        // Use flatData which includes all departments (root + sub-departments)
        setDepartments(response.data.flatData || response.data.data);
        // Store hierarchical data for tree view
        setHierarchicalDepts(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const toggleDeptExpand = (deptId) => {
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

  const expandAllDepts = () => {
    const allIds = new Set();
    const collectIds = (depts) => {
      depts.forEach(d => {
        allIds.add(d._id);
        if (d.children && d.children.length > 0) {
          collectIds(d.children);
        }
      });
    };
    collectIds(hierarchicalDepts);
    setExpandedDepts(allIds);
  };

  const collapseAllDepts = () => {
    setExpandedDepts(new Set());
  };

  // Get employees for a department
  const getEmployeesForDept = (deptId) => {
    return employees.filter(emp => emp.department?._id === deptId);
  };

  // Render department tree with employees
  const renderDepartmentTree = (depts, level) => {
    return depts.map((dept) => {
      const deptEmployees = getEmployeesForDept(dept._id);
      const isExpanded = expandedDepts.has(dept._id);
      const hasChildren = dept.children && dept.children.length > 0;
      const hasEmployees = deptEmployees.length > 0;

      return (
        <div key={dept._id} className={`dept-tree-node level-${level}`}>
          <div className="dept-tree-header" onClick={() => toggleDeptExpand(dept._id)}>
            <div className="dept-tree-info">
              <span className="expand-icon">
                {(hasChildren || hasEmployees) ? (
                  isExpanded ? <i className="fas fa-chevron-down"></i> : <i className="fas fa-chevron-right"></i>
                ) : (
                  <i className="fas fa-circle" style={{fontSize: '6px', opacity: 0.3}}></i>
                )}
              </span>
              <span className="dept-tree-name">{dept.name}</span>
              <span className="dept-tree-code">{dept.code}</span>
              <span className="dept-tree-count">
                <i className="fas fa-users"></i> {deptEmployees.length} employees
              </span>
              {dept.head && (
                <span className="dept-tree-head">
                  👔 Head: {dept.head.name}
                </span>
              )}
            </div>
          </div>
          
          {isExpanded && (
            <div className="dept-tree-content">
              {/* Employees in this department */}
              {hasEmployees && (
                <div className="dept-employees-list">
                  {deptEmployees.map((emp) => (
                    <div key={emp._id} className="tree-employee-card">
                      <div className="tree-emp-avatar">
                        {emp.name?.charAt(0).toUpperCase() || 'E'}
                      </div>
                      <div className="tree-emp-info">
                        <div className="tree-emp-name">{emp.name}</div>
                        <div className="tree-emp-position">{emp.position}</div>
                        <div className="tree-emp-details">
                          <span className="tree-emp-id">{emp.employeeId}</span>
                          {emp.isTeamLead && <span className="tree-emp-lead"><i className="fas fa-star"></i> Team Lead</span>}
                          <span className={`tree-emp-role role-${emp.role?.name || 'employee'}`}>
                            {emp.role?.name || 'Employee'}
                          </span>
                        </div>
                      </div>
                      <div className="tree-emp-actions">
                        <button className="btn-edit-small" onClick={(e) => { e.stopPropagation(); handleEdit(emp); }}>
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="btn-delete-small" onClick={(e) => { e.stopPropagation(); handleDelete(emp._id); }}>
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Child departments */}
              {hasChildren && (
                <div className="dept-children">
                  {renderDepartmentTree(dept.children, level + 1)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  const fetchRoles = async () => {
    try {
      const response = await roleAPI.getAllRoles();
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  // Export functions
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params = {};
      if (selectedDept) params.department = selectedDept;
      
      const response = await exportAPI.employees(params);
      const blob = new Blob([response.data], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `employees_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Employees exported to Excel successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export employees");
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = {};
      if (selectedDept) params.department = selectedDept;
      
      const response = await exportAPI.employeesCsv(params);
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Employees exported to CSV successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export employees");
    } finally {
      setExporting(false);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      fetchEmployees(selectedDept, 1, value);
    }, 500);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchEmployees(selectedDept, newPage, searchTerm);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields before submission
    if (!formData.department || formData.department === "") {
      toast.error("Please select a primary department");
      return;
    }
    
    if (!formData.role || formData.role === "") {
      toast.error("Please select an employee role");
      return;
    }
    
    try {
      setLoading(true);
      
      // Ensure department is a valid string (not empty)
      const submitData = {
        ...formData,
        department: formData.department || null,
      };
      
      // Remove empty additional/leading departments arrays if they're empty
      if (!submitData.additionalDepartments || submitData.additionalDepartments.length === 0) {
        submitData.additionalDepartments = [];
      }
      if (!submitData.leadingDepartments || submitData.leadingDepartments.length === 0) {
        submitData.leadingDepartments = [];
      }
      
      let response;
      if (editMode) {
        response = await employeeAPI.update(editId, submitData);
      } else {
        response = await employeeAPI.create(submitData);
      }
      
      if (response.data.success) {
        toast.success(editMode ? "Employee updated successfully!" : "Employee created successfully!");
        setShowModal(false);
        setEditMode(false);
        setEditId(null);
        setFormData({
          name: "",
          email: "",
          phone: "",
          cnic: "",
          biometricId: "",
          department: "",
          additionalDepartments: [],
          leadingDepartments: [],
          position: "",
          salary: { monthlySalary: "", currency: "PKR", leaveThreshold: 0 },
          workSchedule: {
            checkInTime: "09:00",
            checkOutTime: "17:00",
            workingDaysPerWeek: 5,
            weeklyOffs: ["Saturday", "Sunday"],
            workingHoursPerWeek: 40,
          },
          joiningDate: "",
          password: "",
          isTeamLead: false,
          role: "",
        });
        fetchEmployees(selectedDept);
      }
    } catch (error) {
      console.error("Error creating employee:", error);
      toast.error(error.response?.data?.message || (editMode ? "Failed to update employee" : "Failed to create employee"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      await employeeAPI.delete(id);
      toast.success("Employee deleted successfully!");
      fetchEmployees(selectedDept);
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error(error.response?.data?.message || "Failed to delete employee");
    }
  };

  const handleEdit = (emp) => {
    setEditMode(true);
    setEditId(emp._id);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      cnic: emp.cnic || "",
      biometricId: emp.biometricId || "",
      department: emp.department?._id || "",
      additionalDepartments: emp.additionalDepartments?.map(d => d._id || d) || [],
      leadingDepartments: emp.leadingDepartments?.map(d => d._id || d) || [],
      position: emp.position,
      salary: {
        monthlySalary: emp.salary.monthlySalary,
        currency: emp.salary.currency,
        leaveThreshold: emp.salary.leaveThreshold || 0,
      },
      workSchedule: {
        checkInTime: emp.workSchedule.checkInTime,
        checkOutTime: emp.workSchedule.checkOutTime,
        workingDaysPerWeek: emp.workSchedule.workingDaysPerWeek,
        weeklyOffs: emp.workSchedule.weeklyOffs,
        workingHoursPerWeek: emp.workSchedule.workingHoursPerWeek,
      },
      joiningDate: emp.joiningDate ? emp.joiningDate.split('T')[0] : "",
      password: "",
      isTeamLead: emp.isTeamLead || false,
      role: emp.role?._id || "",
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditId(null);
    
    // Auto-set department for attendanceDepartment users when creating new employee
    let defaultDepartment = "";
    if (currentUser?.role?.name === "attendanceDepartment" && currentUser?.department && !editMode) {
      defaultDepartment = currentUser.department._id || currentUser.department;
    }
    
    setFormData({
      name: "",
      email: "",
      phone: "",
      cnic: "",
      biometricId: "",
      department: defaultDepartment,
      additionalDepartments: [],
      leadingDepartments: [],
      position: "",
      salary: { monthlySalary: "", currency: "PKR", leaveThreshold: 0 },
      workSchedule: {
        checkInTime: "09:00",
        checkOutTime: "17:00",
        workingDaysPerWeek: 5,
        weeklyOffs: ["Saturday", "Sunday"],
        workingHoursPerWeek: 40,
      },
      joiningDate: "",
      password: "",
      isTeamLead: false,
      role: "",
    });
  };

  const handleMultiDeptToggle = (deptId, field) => {
    const currentDepts = formData[field];
    const newDepts = currentDepts.includes(deptId)
      ? currentDepts.filter(d => d !== deptId)
      : [...currentDepts, deptId];
    
    // Auto-set isTeamLead if leading any department
    const updates = { [field]: newDepts };
    if (field === 'leadingDepartments' && newDepts.length > 0) {
      updates.isTeamLead = true;
    }

    // If changing additional departments, clear invalid team lead selections
    if (field === 'additionalDepartments') {
      // Recalculate valid team lead options based on new additional departments
      const validTeamLeadIds = new Set();
      
      // Add primary department and its children
      if (formData.department) {
        validTeamLeadIds.add(String(formData.department));
        const primaryDeptId = String(formData.department);
        getFilteredDepartments().forEach(dept => {
          const deptParentId = dept.parentDepartment 
            ? String(dept.parentDepartment._id || dept.parentDepartment)
            : null;
          if (deptParentId === primaryDeptId || (dept.path && dept.path.includes(primaryDeptId))) {
            validTeamLeadIds.add(String(dept._id));
          }
        });
      }
      
      // Add new additional departments
      newDepts.forEach(deptId => validTeamLeadIds.add(String(deptId)));
      
      // Filter out invalid team lead selections
      updates.leadingDepartments = formData.leadingDepartments.filter(leadDeptId => 
        validTeamLeadIds.has(String(leadDeptId))
      );
    }
    
    setFormData({ ...formData, ...updates });
  };

  const handleWeeklyOffToggle = (day) => {
    const currentOffs = formData.workSchedule.weeklyOffs;
    const newOffs = currentOffs.includes(day)
      ? currentOffs.filter((d) => d !== day)
      : [...currentOffs, day];
    
    // Calculate working days and hours when weekly offs change
    const workingDays = 7 - newOffs.length;
    const weeklyHours = calculateWeeklyHours(
      formData.workSchedule.checkInTime,
      formData.workSchedule.checkOutTime,
      newOffs
    );
    
    setFormData({
      ...formData,
      workSchedule: { 
        ...formData.workSchedule, 
        weeklyOffs: newOffs,
        workingDaysPerWeek: workingDays,
        workingHoursPerWeek: weeklyHours,
      },
    });
  };

  const handleCNICChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
    
    if (value.length > 13) {
      value = value.slice(0, 13); // Limit to 13 digits
    }
    
    // Format: XXXXX-XXXXXXX-X
    let formatted = '';
    if (value.length > 0) {
      formatted = value.slice(0, 5);
    }
    if (value.length > 5) {
      formatted += '-' + value.slice(5, 12);
    }
    if (value.length > 12) {
      formatted += '-' + value.slice(12, 13);
    }
    
    setFormData({ ...formData, cnic: formatted });
  };

  const calculateWeeklyHours = (checkIn, checkOut, weeklyOffs) => {
    if (!checkIn || !checkOut) return 0;
    
    // Calculate working days from weeklyOffs (7 days - number of offs)
    const workingDays = 7 - (weeklyOffs?.length || 0);
    
    const [inHour, inMinute] = checkIn.split(':').map(Number);
    const [outHour, outMinute] = checkOut.split(':').map(Number);
    
    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    
    const dailyMinutes = outMinutes - inMinutes;
    const dailyHours = dailyMinutes / 60;
    
    return dailyHours * workingDays;
  };

  const handleWorkScheduleChange = (field, value) => {
    const updatedSchedule = { ...formData.workSchedule, [field]: value };
    
    // Calculate working days from weeklyOffs
    const workingDays = 7 - (updatedSchedule.weeklyOffs?.length || 0);
    
    // Auto-calculate weekly hours
    const weeklyHours = calculateWeeklyHours(
      updatedSchedule.checkInTime,
      updatedSchedule.checkOutTime,
      updatedSchedule.weeklyOffs
    );
    
    setFormData({
      ...formData,
      workSchedule: {
        ...updatedSchedule,
        workingDaysPerWeek: workingDays,
        workingHoursPerWeek: weeklyHours,
      },
    });
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="employees-page">
          <div className="page-header">
        <h1>Employees</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <i className="fas fa-table"></i> Table
            </button>
            <button 
              className={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree View"
            >
              <i className="fas fa-sitemap"></i> Tree
            </button>
          </div>
          {viewMode === 'tree' && (
            <div className="tree-controls">
              <button className="btn-secondary" onClick={expandAllDepts}>
                <i className="fas fa-expand-arrows-alt"></i> Expand All
              </button>
              <button className="btn-secondary" onClick={collapseAllDepts}>
                <i className="fas fa-compress-arrows-alt"></i> Collapse All
              </button>
            </div>
          )}
          {viewMode === 'table' && (
            <>
              <input
                type="text"
                className="search-input"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={handleSearch}
              />
              <select
                className="dept-filter"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  fetchEmployees(e.target.value, 1, searchTerm);
                }}
              >
                <option value="">All Departments</option>
                {getFilteredDepartments().map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {"—".repeat(dept.level || 0)} {dept.name}
                  </option>
                ))}
              </select>
              <div className="export-buttons">
                <button 
                  className="btn-export" 
                  onClick={handleExportExcel}
                  disabled={exporting}
                  title="Export to Excel"
                >
                  {exporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-excel"></i>} Excel
                </button>
                <button 
                  className="btn-export" 
                  onClick={handleExportCsv}
                  disabled={exporting}
                  title="Export to CSV"
                >
                  {exporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-csv"></i>} CSV
                </button>
              </div>
            </>
          )}
          <button className="btn-primary" onClick={() => {
            setEditMode(false);
            setEditId(null);
            
            // Auto-set department for attendanceDepartment users
            // If there's only one department available, use it
            let defaultDepartment = "";
            if (currentUser?.role?.name === "attendanceDepartment") {
              if (currentUser?.department) {
                defaultDepartment = String(currentUser.department._id || currentUser.department);
              } else {
                // If no assigned department, use the first available department
                const filteredDepts = getFilteredDepartments();
                if (filteredDepts.length > 0) {
                  defaultDepartment = String(filteredDepts[0]._id);
                }
              }
            }
            
            // Reset form data with default department
            setFormData({
              name: "",
              email: "",
              phone: "",
              cnic: "",
              biometricId: "",
              department: defaultDepartment,
              additionalDepartments: [],
              leadingDepartments: [],
              position: "",
              salary: { monthlySalary: "", currency: "PKR", leaveThreshold: 0 },
              workSchedule: {
                checkInTime: "09:00",
                checkOutTime: "17:00",
                workingDaysPerWeek: 5,
                weeklyOffs: ["Saturday", "Sunday"],
                workingHoursPerWeek: 40,
              },
              joiningDate: "",
              password: "",
              isTeamLead: false,
              role: "",
            });
            
            setShowModal(true);
          }}>
            + Add Employee
          </button>
        </div>
      </div>

      {loading && employees.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : viewMode === 'table' ? (
        <div className="employees-table">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Biometric ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>CNIC</th>
                <th>Department</th>
                <th>Position</th>
                <th>Role</th>
                <th>Salary</th>
                <th>Working Hours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp._id}>
                  <td className="emp-id">{emp.employeeId}</td>
                  <td className="bio-id">{emp.biometricId || "-"}</td>
                  <td>{emp.name}</td>
                  <td>{emp.email || "-"}</td>
                  <td>{emp.phone || "-"}</td>
                  <td>{emp.cnic || "-"}</td>
                  <td>
                    <div className="dept-badges-container">
                      {/* Primary Department */}
                      <span className="dept-badge-primary" title="Primary Department">
                        {emp.department?.name || "-"}
                        {emp.leadingDepartments?.some(d => d._id === emp.department?._id) && <> <i className="fas fa-star"></i></>}
                      </span>
                      {/* Leading Departments (excluding primary) */}
                      {emp.leadingDepartments?.filter(dept => dept._id !== emp.department?._id).map((dept) => (
                        <span key={`lead-${dept._id}`} className="dept-badge-lead" title={`Team Lead of ${dept.name}`}>
                          <i className="fas fa-star"></i> {dept.name}
                        </span>
                      ))}
                      {/* Additional Departments (excluding primary and leading) */}
                      {(() => {
                        const primaryId = emp.department?._id;
                        const leadingIds = emp.leadingDepartments?.map(d => d._id) || [];
                        const filteredAdditional = emp.additionalDepartments?.filter(
                          dept => dept._id !== primaryId && !leadingIds.includes(dept._id)
                        ) || [];
                        return (
                          <>
                            {filteredAdditional.slice(0, 2).map((dept) => (
                              <span key={`add-${dept._id}`} className="dept-badge-secondary" title={`Also works in ${dept.name}`}>
                                {dept.name}
                              </span>
                            ))}
                            {filteredAdditional.length > 2 && (
                              <span className="more-depts" title={filteredAdditional.slice(2).map(d => d.name).join(', ')}>
                                +{filteredAdditional.length - 2}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td>{emp.position}</td>
                  <td>
                    <span className={`role-badge role-${emp.role?.name || 'employee'}`}>
                      {emp.role?.name || 'Employee'}
                    </span>
                  </td>
                  <td>
                    {emp.salary?.monthlySalary?.toLocaleString() || "0"}/{emp.salary?.currency || "PKR"}
                  </td>
                  <td>
                    {emp.workSchedule?.checkInTime || "0"} - {emp.workSchedule?.checkOutTime || "-"}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit-small"
                        onClick={() => handleEdit(emp)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete-small"
                        onClick={() => handleDelete(emp._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {employees.length} of {pagination.total} employees
              </div>
              <div className="pagination-buttons">
                <button 
                  className="pagination-btn"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                  title="First Page"
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button 
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  title="Previous Page"
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
                  title="Next Page"
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button 
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.pages)}
                  disabled={pagination.page === pagination.pages}
                  title="Last Page"
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="employees-tree-view">
          {hierarchicalDepts.length === 0 ? (
            <div className="no-data">No departments found</div>
          ) : (
            <div className="dept-tree-container">
              {renderDepartmentTree(hierarchicalDepts, 0)}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-content modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editMode ? "Edit Employee" : "Add Employee"}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>CNIC</label>
                  <input
                    type="text"
                    value={formData.cnic}
                    onChange={handleCNICChange}
                    placeholder="XXXXX-XXXXXXX-X"
                    maxLength="15"
                    title="Format: XXXXX-XXXXXXX-X (e.g., 12345-1234567-1)"
                  />
                </div>
                <div className="form-group">
                  <label>Biometric ID (Optional but required for attendance tracking)</label>
                  <input
                    type="text"
                    value={formData.biometricId}
                    onChange={(e) =>
                      setFormData({ ...formData, biometricId: e.target.value })
                    }
                    placeholder="e.g., 1001"
                    maxLength="10"
                  />
                  <small>Numeric ID used in biometric device (if applicable)</small>
                </div>
                <div className="form-group">
                  <label>Primary Department *</label>
                  <select
                    value={formData.department || ""}
                    onChange={(e) => {
                      const newPrimaryDept = e.target.value;
                      
                      // When primary changes, we need to:
                      // 1. Remove it from additional departments
                      // 2. Clear additional departments (they depend on primary being siblings)
                      // 3. Clear team lead departments (they depend on primary + additional)
                      setFormData({ 
                        ...formData, 
                        department: newPrimaryDept,
                        additionalDepartments: [],
                        leadingDepartments: []
                      });
                    }}
                    required
                    disabled={currentUser?.role?.name === "attendanceDepartment" && getFilteredDepartments().length === 1}
                  >
                    <option value="">Select Primary Department</option>
                    {getFilteredDepartments().map((dept) => (
                      <option key={dept._id} value={String(dept._id)}>
                        {"—".repeat(dept.level || 0)} {dept.name} ({dept.code})
                        {dept.parentDepartment ? ` ← ${dept.parentDepartment.name || ''}` : ''}
                      </option>
                    ))}
                  </select>
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    {currentUser?.role?.name === "attendanceDepartment" 
                      ? getFilteredDepartments().length === 1 
                        ? "Department is auto-selected based on your assignment"
                        : "You can only assign employees to your own department or its sub-departments"
                      : "Used for attendance tracking and salary calculation"}
                  </small>
                </div>

                <div className="form-group full-width">
                  <label>Additional Departments</label>
                  <div className="checkbox-grid multi-dept-grid">
                    {getAdditionalDepartmentsOptions().map((dept) => (
                        <label key={dept._id} className="checkbox-label dept-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.additionalDepartments.includes(dept._id)}
                            onChange={() => handleMultiDeptToggle(dept._id, 'additionalDepartments')}
                          />
                          <span className="dept-name">
                            {"—".repeat(dept.level || 0)} {dept.name}
                          </span>
                          <span className="dept-code">({dept.code})</span>
                        </label>
                      ))}
                  </div>
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    {currentUser?.role?.name === "attendanceDepartment"
                      ? "You can only assign employees to departments you created (showing siblings of primary department)"
                      : "Select departments where this employee also works (showing siblings of primary department)"}
                  </small>
                </div>

                <div className="form-group full-width">
                  <label>Team Lead Of</label>
                  <div className="checkbox-grid multi-dept-grid leading-grid">
                    {getTeamLeadOfOptions().map((dept) => (
                      <label key={dept._id} className="checkbox-label dept-checkbox lead-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.leadingDepartments.includes(dept._id)}
                          onChange={() => handleMultiDeptToggle(dept._id, 'leadingDepartments')}
                        />
                        <span className="dept-name">
                          {"—".repeat(dept.level || 0)} {dept.name}
                        </span>
                        <span className="dept-code">({dept.code})</span>
                      </label>
                    ))}
                  </div>
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    {currentUser?.role?.name === "attendanceDepartment"
                      ? "You can only assign team lead roles within selected departments (primary + additional + their children)"
                      : "Select departments where this employee is a Team Lead (from primary + additional departments)"}
                  </small>
                </div>

                <div className="form-group">
                  <label>Position *</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Salary</label>
                  <input
                    type="number"
                    value={formData.salary.monthlySalary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salary: { ...formData.salary, monthlySalary: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Leave Threshold (Allowed Leaves per Month)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.salary.leaveThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salary: { ...formData.salary, leaveThreshold: parseInt(e.target.value) || 0 },
                      })
                    }
                    placeholder="0 = all leaves deducted from salary"
                  />
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    Leaves exceeding this number will be marked as absent for salary calculation
                  </small>
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Employee Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const selectedRole = roles.find(r => r._id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        role: e.target.value,
                        isTeamLead: selectedRole?.name === "teamLead"
                      });
                    }}
                    required
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role._id} value={role._id}>
                        {role.name} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Password {!editMode && "(Optional)"}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={editMode ? "Leave blank to keep current" : "Auto: Emp@{last4digits}"}
                  />
                  <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                    {editMode 
                      ? "Leave empty to keep existing password" 
                      : "If empty, password will be auto-generated as: Emp@{last 4 digits of Employee ID}"}
                  </small>
                </div>
              </div>

              <h3 className="section-title">Work Schedule</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Check-in Time *</label>
                  <input
                    type="time"
                    value={formData.workSchedule.checkInTime}
                    onChange={(e) => handleWorkScheduleChange('checkInTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Check-out Time *</label>
                  <input
                    type="time"
                    value={formData.workSchedule.checkOutTime}
                    onChange={(e) => handleWorkScheduleChange('checkOutTime', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Working Days Per Week *</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={formData.workSchedule.workingDaysPerWeek}
                    onChange={(e) => handleWorkScheduleChange('workingDaysPerWeek', parseInt(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Working Hours Per Week (Auto-calculated)</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={formData.workSchedule.workingHoursPerWeek}
                    readOnly
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
                  />
                  <small>Automatically calculated from check-in/out times and working days</small>
                </div>
              </div>

              <div className="form-group" style={{padding: '0 29px'}}>
                <label >Weekly Offs *</label>
                <div className="weekdays-grid">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <label key={day} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.workSchedule.weeklyOffs.includes(day)}
                        onChange={() => handleWeeklyOffToggle(day)}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (editMode ? "Updating..." : "Creating...") : (editMode ? "Update Employee" : "Create Employee")}
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

export default Employees;
