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
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showExportFieldsModal, setShowExportFieldsModal] = useState(false);
  const [exportFormat, setExportFormat] = useState(null); // 'xlsx' or 'csv'
  const [selectedExportFields, setSelectedExportFields] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });

  // Define all available export fields
  const exportFields = [
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'cnic', label: 'CNIC' },
    { key: 'department', label: 'Department' },
    { key: 'additionalDepts', label: 'Additional Departments' },
    { key: 'leadingDepts', label: 'Leading Departments' },
    { key: 'role', label: 'Role' },
    { key: 'position', label: 'Position' },
    { key: 'workSchedule', label: 'Work Schedule' },
    { key: 'joinDate', label: 'Join Date' },
    { key: 'status', label: 'Status' },
  ];

  // Initialize selected fields on component mount
  useEffect(() => {
    const initialFields = {};
    exportFields.forEach(field => {
      initialFields[field.key] = true;
    });
    setSelectedExportFields(initialFields);
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
    biometricId: "",
    department: "",
    additionalDepartments: [],
    shifts: [],
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
      daySchedules: {}, // Day-specific schedules
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

  // Import functions
  const handleDownloadTemplate = async () => {
    try {
      const response = await employeeAPI.downloadTemplate();
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "employee_import_template.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded successfully!");
    } catch (error) {
      console.error("Template download failed:", error);
      toast.error("Failed to download template");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!validTypes.includes(file.type)) {
        toast.error("Please select a valid Excel file (.xlsx or .xls)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setImportFile(file);
    }
  };

  const handleImportEmployees = async () => {
    if (!importFile) {
      toast.error("Please select an Excel file");
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("excelFile", importFile);

      const response = await employeeAPI.importEmployees(formData);
      
      if (response.data.success) {
        setImportResults(response.data.data);
        toast.success(
          `Import completed! ${response.data.data.successful} employees created successfully, ${response.data.data.failed} failed.`
        );
        
        // Refresh employee list
        fetchEmployees(selectedDept, pagination.page, searchTerm);
        
        // Reset file input
        setImportFile(null);
        const fileInput = document.getElementById("excelFileInput");
        if (fileInput) fileInput.value = "";
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(error.response?.data?.message || "Failed to import employees");
    } finally {
      setImporting(false);
    }
  };

  // Export functions
  const handleExportExcel = () => {
    setExportFormat('xlsx');
    setShowExportFieldsModal(true);
  };

  const handleExportCsv = () => {
    setExportFormat('csv');
    setShowExportFieldsModal(true);
  };

  // Perform the actual export
  const handleConfirmExport = async () => {
    try {
      setExporting(true);
      const selectedFields = Object.keys(selectedExportFields).filter(key => selectedExportFields[key]);
      
      if (selectedFields.length === 0) {
        toast.error("Please select at least one field to export");
        setExporting(false);
        return;
      }

      const params = {
        fields: selectedFields.join(','),
      };
      if (selectedDept) params.department = selectedDept;
      
      const response = exportFormat === 'xlsx' 
        ? await exportAPI.employees(params)
        : await exportAPI.employeesCsv(params);
      
      const blob = new Blob([response.data], { 
        type: exportFormat === 'xlsx' 
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv"
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `employees_${new Date().toISOString().split("T")[0]}.${exportFormat === 'xlsx' ? 'xlsx' : 'csv'}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Employees exported to ${exportFormat === 'xlsx' ? 'Excel' : 'CSV'} successfully!`);
      setShowExportFieldsModal(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export employees");
    } finally {
      setExporting(false);
    }
  };

  const handleToggleExportField = (fieldKey) => {
    setSelectedExportFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const handleSelectAllExportFields = () => {
    const allSelected = Object.values(selectedExportFields).every(v => v);
    const newFields = {};
    exportFields.forEach(field => {
      newFields[field.key] = !allSelected;
    });
    setSelectedExportFields(newFields);
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
      
      const isSuperAdmin = currentUser?.role?.name === "superAdmin";

      // Build shifts array: primary shift + additional shifts
      const allShifts = [
        {
          department: formData.department,
          isPrimary: true,
          position: formData.position || "",
          monthlySalary: formData.salary?.monthlySalary ? parseFloat(formData.salary.monthlySalary) : null,
          currency: formData.salary?.currency || "PKR",
          leaveThreshold: formData.salary?.leaveThreshold || 0,
          joiningDate: formData.joiningDate || null,
          workSchedule: formData.workSchedule,
          isActive: true,
        },
        ...(formData.shifts || []).filter(s => s.department).map(s => {
          const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const workingDays = s.daysOfWeek && s.daysOfWeek.length > 0
            ? s.daysOfWeek
            : allDays.filter(d => !(s.workSchedule?.weeklyOffs || ["Saturday", "Sunday"]).includes(d));
          const weeklyOffs = allDays.filter(d => !workingDays.includes(d));
          return {
            ...s,
            isPrimary: false,
            isActive: s.isActive !== false,
            daysOfWeek: workingDays,
            workSchedule: {
              checkInTime: s.startTime || s.workSchedule?.checkInTime || "08:00",
              checkOutTime: s.endTime || s.workSchedule?.checkOutTime || "14:00",
              workingDaysPerWeek: workingDays.length,
              workingHoursPerWeek: s.workSchedule?.workingHoursPerWeek || 40,
              weeklyOffs: weeklyOffs,
              daySchedules: s.daySchedules || s.workSchedule?.daySchedules || {},
            },
          };
        })
      ];

      // Ensure department is a valid string (not empty)
      const submitData = {
        ...formData,
        department: formData.department || null,
        shifts: allShifts,
      };

      // Remove old individual fields that are now in shifts
      delete submitData.position;
      delete submitData.salary;
      delete submitData.workSchedule;
      delete submitData.joiningDate;
      delete submitData.additionalDepartments;
      
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
          shifts: [],
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
    
    // Extract primary and non-primary shifts
    const primaryShift = emp.shifts?.find(s => s.isPrimary) || emp.shifts?.[0] || {};
    const nonPrimaryShifts = (emp.shifts || []).filter(s => !s.isPrimary);
    
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      cnic: emp.cnic || "",
      biometricId: emp.biometricId || "",
      department: emp.department?._id || "",
      additionalDepartments: nonPrimaryShifts.map(s => s.department?._id || s.department).filter(Boolean),
      shifts: nonPrimaryShifts.map(shift => ({
        department: shift.department?._id || shift.department || "",
        startTime: shift.workSchedule?.checkInTime || shift.startTime || "08:00",
        endTime: shift.workSchedule?.checkOutTime || shift.endTime || "14:00",
        workSchedule: shift.workSchedule || { checkInTime: "08:00", checkOutTime: "14:00", workingDaysPerWeek: 5, weeklyOffs: ["Saturday", "Sunday"], workingHoursPerWeek: 40 },
        daysOfWeek: (shift.daysOfWeek && shift.daysOfWeek.length > 0)
          ? shift.daysOfWeek
          : (shift.workSchedule?.weeklyOffs
            ? ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].filter(d => !shift.workSchedule.weeklyOffs.includes(d))
            : ["Monday","Tuesday","Wednesday","Thursday","Friday"]),
        position: shift.position || "",
        monthlySalary: shift.monthlySalary || 0,
        currency: shift.currency || "PKR",
        leaveThreshold: shift.leaveThreshold || 0,
        joiningDate: shift.joiningDate ? shift.joiningDate.split('T')[0] : "",
        isActive: shift.isActive !== false,
        daySchedules: shift.workSchedule?.daySchedules || shift.daySchedules || {},
      })),
      leadingDepartments: emp.leadingDepartments?.map(d => d._id || d) || [],
      position: primaryShift.position || emp.position || "",
      salary: {
        monthlySalary: primaryShift.monthlySalary || emp.salary?.monthlySalary || "",
        currency: primaryShift.currency || emp.salary?.currency || "PKR",
        leaveThreshold: primaryShift.leaveThreshold || emp.salary?.leaveThreshold || 0,
      },
      workSchedule: {
        checkInTime: primaryShift.workSchedule?.checkInTime || emp.workSchedule?.checkInTime || "09:00",
        checkOutTime: primaryShift.workSchedule?.checkOutTime || emp.workSchedule?.checkOutTime || "17:00",
        workingDaysPerWeek: primaryShift.workSchedule?.workingDaysPerWeek || emp.workSchedule?.workingDaysPerWeek || 5,
        weeklyOffs: primaryShift.workSchedule?.weeklyOffs || emp.workSchedule?.weeklyOffs || ["Saturday", "Sunday"],
        workingHoursPerWeek: primaryShift.workSchedule?.workingHoursPerWeek || emp.workSchedule?.workingHoursPerWeek || 40,
        daySchedules: primaryShift.workSchedule?.daySchedules || emp.workSchedule?.daySchedules || {},
      },
      joiningDate: primaryShift.joiningDate ? primaryShift.joiningDate.split('T')[0] : (emp.joiningDate ? emp.joiningDate.split('T')[0] : ""),
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
      shifts: [],
      leadingDepartments: [],
      position: "",
      salary: { monthlySalary: "", currency: "PKR", leaveThreshold: 0 },
      workSchedule: {
        checkInTime: "09:00",
        checkOutTime: "17:00",
        workingDaysPerWeek: 5,
        weeklyOffs: ["Saturday", "Sunday"],
        workingHoursPerWeek: 40,
        daySchedules: {},
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

      // Remove shifts that are no longer in primary + additional departments
      const validShiftDeptIds = new Set([
        formData.department,
        ...newDepts
      ].filter(Boolean).map(String));

      updates.shifts = (formData.shifts || []).filter(shift =>
        shift.department && validShiftDeptIds.has(String(shift.department))
      );
    }
    
    setFormData({ ...formData, ...updates });
  };

  const getShiftDepartmentOptions = () => {
    const selectedDeptIds = [formData.department, ...formData.additionalDepartments]
      .filter(Boolean)
      .map(String);

    return departments.filter(d => selectedDeptIds.includes(String(d._id)));
  };

  const handleAddShift = () => {
    const options = getShiftDepartmentOptions();
    const defaultDept = options[0]?._id || "";

    const newShift = {
      department: defaultDept,
      workSchedule: {
        checkInTime: "08:00",
        checkOutTime: "14:00",
        workingDaysPerWeek: 5,
        weeklyOffs: ["Saturday", "Sunday"],
        workingHoursPerWeek: 40,
        daySchedules: {},
      },
      position: "",
      monthlySalary: 0,
      currency: "PKR",
      leaveThreshold: 0,
      joiningDate: "",
      isActive: true,
    };

    setFormData({
      ...formData,
      shifts: [...(formData.shifts || []), newShift],
    });
  };

  const handleRemoveShift = (index) => {
    const updated = (formData.shifts || []).filter((_, i) => i !== index);
    setFormData({ ...formData, shifts: updated });
  };

  const handleShiftChange = (index, field, value) => {
    const updated = [...(formData.shifts || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, shifts: updated });
  };

  const handleAddShiftDaySchedule = (shiftIndex, day) => {
    const updated = [...(formData.shifts || [])];
    const shift = updated[shiftIndex] || {};
    const daySchedules = shift.daySchedules || {};
    
    daySchedules[day] = {
      startTime: shift.startTime || "08:00",
      endTime: shift.endTime || "14:00",
    };
    
    updated[shiftIndex] = { ...shift, daySchedules };
    setFormData({ ...formData, shifts: updated });
  };

  const handleRemoveShiftDaySchedule = (shiftIndex, day) => {
    const updated = [...(formData.shifts || [])];
    const shift = updated[shiftIndex] || {};
    const daySchedules = { ...(shift.daySchedules || {}) };
    delete daySchedules[day];
    
    updated[shiftIndex] = { ...shift, daySchedules };
    setFormData({ ...formData, shifts: updated });
  };

  const handleShiftDayScheduleChange = (shiftIndex, day, field, value) => {
    const updated = [...(formData.shifts || [])];
    const shift = updated[shiftIndex] || {};
    const daySchedules = { ...(shift.daySchedules || {}) };
    
    daySchedules[day] = {
      ...(daySchedules[day] || {}),
      [field]: value,
    };
    
    updated[shiftIndex] = { ...shift, daySchedules };
    setFormData({ ...formData, shifts: updated });
  };

  const handleShiftDayToggle = (index, day) => {
    const updated = [...(formData.shifts || [])];
    const shift = updated[index] || {};
    const currentDays = shift.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];

    updated[index] = { ...shift, daysOfWeek: newDays };
    setFormData({ ...formData, shifts: updated });
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

  const handleDayScheduleChange = (day, field, value) => {
    const daySchedules = { ...formData.workSchedule.daySchedules };
    
    if (!daySchedules[day]) {
      daySchedules[day] = {
        checkInTime: formData.workSchedule.checkInTime,
        checkOutTime: formData.workSchedule.checkOutTime,
        isHalfDay: false,
        isOff: false
      };
    }
    
    daySchedules[day][field] = value;
    
    setFormData({
      ...formData,
      workSchedule: {
        ...formData.workSchedule,
        daySchedules
      }
    });
  };

  const handleRemoveDaySchedule = (day) => {
    const daySchedules = { ...formData.workSchedule.daySchedules };
    delete daySchedules[day];
    
    setFormData({
      ...formData,
      workSchedule: {
        ...formData.workSchedule,
        daySchedules
      }
    });
  };

  const handleAddDaySchedule = (day) => {
    const daySchedules = { ...formData.workSchedule.daySchedules };
    
    daySchedules[day] = {
      checkInTime: formData.workSchedule.checkInTime,
      checkOutTime: formData.workSchedule.checkOutTime,
      isHalfDay: false,
      isOff: false
    };
    
    setFormData({
      ...formData,
      workSchedule: {
        ...formData.workSchedule,
        daySchedules
      }
    });
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="employees-page">
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-users"></i>
              </div>
              <div>
                <h1>Employees</h1>
                <p>Manage employee records and information</p>
              </div>
            </div>
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
          {/*
          <button 
            className="btn-secondary" 
            onClick={handleDownloadTemplate}
            style={{ marginRight: "10px" }}
            title="Download Excel template for importing employees"
          >
            <i className="fas fa-download"></i> Download Template
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => {
              setShowImportModal(true);
              setImportResults(null);
              setImportFile(null);
            }}
            style={{ marginRight: "10px" }}
            title="Import employees from Excel file"
          >
            <i className="fas fa-file-upload"></i> Import Employees
          </button>
          */}
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
                      {/* Additional Departments from shifts (excluding primary and leading) */}
                      {(() => {
                        const primaryId = emp.department?._id;
                        const leadingIds = emp.leadingDepartments?.map(d => d._id) || [];
                        const shiftDepts = (emp.shifts || [])
                          .filter(s => !s.isPrimary && s.department)
                          .map(s => s.department)
                          .filter(dept => dept?._id !== primaryId && !leadingIds.includes(dept?._id));
                        return (
                          <>
                            {shiftDepts.slice(0, 2).map((dept) => (
                              <span key={`add-${dept._id}`} className="dept-badge-secondary" title={`Also works in ${dept.name || "Unknown"}`}>
                                {dept.name || "Unknown"}
                              </span>
                            ))}
                            {shiftDepts.length > 2 && (
                              <span className="more-depts" title={shiftDepts.slice(2).map(d => d.name).join(', ')}>
                                +{shiftDepts.length - 2}
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
                  {(() => {
                    // For department heads editing multi-dept employees, show primary dept as read-only
                    const isAttDeptHead = currentUser?.role?.name === "attendanceDepartment";
                    const hasShifts = formData.shifts && formData.shifts.length > 0;
                    const filteredDepts = getFilteredDepartments();
                    const currentPrimaryDeptId = String(formData.department || "");
                    const currentPrimaryDept = departments.find(d => String(d._id) === currentPrimaryDeptId);
                    const isPrimaryInFiltered = filteredDepts.some(d => String(d._id) === currentPrimaryDeptId);
                    
                    // Disable if: dept head + employee has shifts (multi-dept employee)
                    // OR dept head and only one dept available
                    const shouldDisable = isAttDeptHead && (hasShifts || filteredDepts.length === 1);
                    
                    // Build options list: include current primary even if not in filtered list
                    const deptOptions = isPrimaryInFiltered || !currentPrimaryDeptId
                      ? filteredDepts
                      : [currentPrimaryDept, ...filteredDepts].filter(Boolean);
                    
                    return (
                      <>
                        <select
                          value={formData.department || ""}
                          onChange={(e) => {
                            const newPrimaryDept = e.target.value;
                            setFormData({ 
                              ...formData, 
                              department: newPrimaryDept,
                              additionalDepartments: [],
                              leadingDepartments: [],
                              shifts: []
                            });
                          }}
                          required
                          disabled={shouldDisable}
                        >
                          <option value="">Select Primary Department</option>
                          {deptOptions.map((dept) => (
                            <option key={dept._id} value={String(dept._id)}>
                              {"—".repeat(dept.level || 0)} {dept.name} ({dept.code})
                              {dept.parentDepartment ? ` ← ${dept.parentDepartment.name || ''}` : ''}
                            </option>
                          ))}
                        </select>
                        <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px'}}>
                          {isAttDeptHead 
                            ? hasShifts
                              ? "Primary department is managed by superAdmin for multi-department employees"
                              : filteredDepts.length === 1 
                                ? "Department is auto-selected based on your assignment"
                                : "You can only assign employees to your own department or its sub-departments"
                            : "Used for attendance tracking and salary calculation"}
                        </small>
                      </>
                    );
                  })()}
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

                {currentUser?.role?.name === "superAdmin" && (
                  <div className="form-group full-width">
                    <label>Department Shifts (Admin Only)</label>
                    {formData.additionalDepartments.length === 0 ? (
                      <small style={{color: '#64748b', fontSize: '12px'}}>
                        Add additional departments to configure multi-department shifts.
                      </small>
                    ) : (
                      <div style={{marginTop: '8px'}}>
                        {(formData.shifts || []).map((shift, index) => (
                          <div
                            key={`shift-${index}`}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              padding: '12px',
                              marginBottom: '10px',
                              background: '#f9fafb'
                            }}
                          >
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px'}}>
                              <div className="form-group" style={{margin: 0}}>
                                <label>Department</label>
                                <select
                                  value={shift.department || ""}
                                  onChange={(e) => handleShiftChange(index, 'department', e.target.value)}
                                >
                                  {getShiftDepartmentOptions().map((dept) => (
                                    <option key={dept._id} value={String(dept._id)}>
                                      {dept.name} ({dept.code})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-group" style={{margin: 0}}>
                                <label>Start Time</label>
                                <input
                                  type="time"
                                  value={shift.startTime || ""}
                                  onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                                />
                              </div>
                              <div className="form-group" style={{margin: 0}}>
                                <label>End Time</label>
                                <input
                                  type="time"
                                  value={shift.endTime || ""}
                                  onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                                />
                              </div>
                              <div className="form-group" style={{margin: 0, display: 'flex', alignItems: 'flex-end'}}>
                                <button
                                  type="button"
                                  className="btn-delete-small"
                                  onClick={() => handleRemoveShift(index)}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            {/* Department-specific fields */}
                            <div style={{marginTop: '12px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb'}}>
                              <label style={{display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#374151'}}>
                                <i className="fas fa-briefcase" style={{marginRight: '6px'}}></i>
                                Department-Specific Details
                              </label>
                              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                                <div className="form-group" style={{margin: 0}}>
                                  <label style={{fontSize: '12px'}}>Position/Role</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., Developer, Manager"
                                    value={shift.position || ""}
                                    onChange={(e) => handleShiftChange(index, 'position', e.target.value)}
                                    style={{fontSize: '13px', padding: '6px 8px'}}
                                  />
                                </div>
                                <div className="form-group" style={{margin: 0}}>
                                  <label style={{fontSize: '12px'}}>Monthly Salary (PKR)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g., 50000"
                                    value={shift.monthlySalary || ""}
                                    onChange={(e) => handleShiftChange(index, 'monthlySalary', parseFloat(e.target.value) || 0)}
                                    style={{fontSize: '13px', padding: '6px 8px'}}
                                  />
                                </div>
                                <div className="form-group" style={{margin: 0}}>
                                  <label style={{fontSize: '12px'}}>Leave Threshold (per month)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="e.g., 2"
                                    value={shift.leaveThreshold || 0}
                                    onChange={(e) => handleShiftChange(index, 'leaveThreshold', parseInt(e.target.value) || 0)}
                                    style={{fontSize: '13px', padding: '6px 8px'}}
                                  />
                                  <small style={{fontSize: '10px', color: '#6b7280'}}>Allowed leaves before absent</small>
                                </div>
                                <div className="form-group" style={{margin: 0}}>
                                  <label style={{fontSize: '12px'}}>Joining Date (this dept)</label>
                                  <input
                                    type="date"
                                    value={shift.joiningDate ? shift.joiningDate.split('T')[0] : ""}
                                    onChange={(e) => handleShiftChange(index, 'joiningDate', e.target.value)}
                                    style={{fontSize: '13px', padding: '6px 8px'}}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="weekdays-grid" style={{marginTop: '8px'}}>
                              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                <label key={`${index}-${day}`} className="checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={(shift.daysOfWeek || []).includes(day)}
                                    onChange={() => handleShiftDayToggle(index, day)}
                                  />
                                  {day}
                                </label>
                              ))}
                            </div>

                            <div style={{marginTop: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '10px'}}>
                              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                                <label style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 0}}>
                                  <i className="fas fa-calendar-day"></i>
                                  <strong>Day-Specific Schedules (Optional)</strong>
                                  <small style={{fontWeight: 'normal', color: '#64748b'}}>(Override default times for specific days)</small>
                                </label>
                              </div>
                              
                              {/* Show only days that have custom schedules */}
                              {shift.daySchedules && Object.keys(shift.daySchedules).length > 0 && (
                                <div style={{marginBottom: '8px'}}>
                                  {Object.entries(shift.daySchedules).map(([day, schedule]) => (
                                    <div
                                      key={`shift-${index}-day-${day}`}
                                      style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        padding: '8px',
                                        marginBottom: '6px',
                                        backgroundColor: '#f0f9ff',
                                      }}
                                    >
                                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                          <strong style={{minWidth: '80px', fontSize: '13px'}}>{day}</strong>
                                          <span style={{fontSize: '11px', color: '#0369a1'}}>Custom time</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveShiftDaySchedule(index, day)}
                                          style={{
                                            padding: '2px 8px',
                                            fontSize: '11px',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <i className="fas fa-times"></i> Remove
                                        </button>
                                      </div>
                                      
                                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                                        <div>
                                          <label style={{fontSize: '11px', color: '#6b7280'}}>Start Time</label>
                                          <input
                                            type="time"
                                            value={schedule.startTime || ""}
                                            onChange={(e) => handleShiftDayScheduleChange(index, day, 'startTime', e.target.value)}
                                            style={{width: '100%', fontSize: '12px', padding: '4px'}}
                                          />
                                        </div>
                                        <div>
                                          <label style={{fontSize: '11px', color: '#6b7280'}}>End Time</label>
                                          <input
                                            type="time"
                                            value={schedule.endTime || ""}
                                            onChange={(e) => handleShiftDayScheduleChange(index, day, 'endTime', e.target.value)}
                                            style={{width: '100%', fontSize: '12px', padding: '4px'}}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Dropdown to add custom schedule for a specific day */}
                              {shift.daysOfWeek && shift.daysOfWeek.length > 0 && (
                                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                  <select
                                    style={{
                                      flex: 1,
                                      padding: '6px 8px',
                                      fontSize: '12px',
                                      borderRadius: '4px',
                                      border: '1px solid #d1d5db',
                                    }}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleAddShiftDaySchedule(index, e.target.value);
                                        e.target.value = ''; // Reset dropdown
                                      }
                                    }}
                                    value=""
                                  >
                                    <option value="">+ Add custom time for a specific day...</option>
                                    {shift.daysOfWeek
                                      .filter(day => !shift.daySchedules || !shift.daySchedules[day])
                                      .map(day => (
                                        <option key={day} value={day}>{day}</option>
                                      ))}
                                  </select>
                                </div>
                              )}
                              
                              {(!shift.daysOfWeek || shift.daysOfWeek.length === 0) && (
                                <small style={{color: '#9ca3af', fontSize: '11px', display: 'block'}}>
                                  Select days of the week first to add custom schedules
                                </small>
                              )}
                            </div>

                            <div style={{marginTop: '10px'}}>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={shift.isActive !== false}
                                  onChange={(e) => handleShiftChange(index, 'isActive', e.target.checked)}
                                />
                                Active Shift
                              </label>
                            </div>
                          </div>
                        ))}

                        <button 
                          type="button" 
                          onClick={handleAddShift}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                          }}
                        >
                          <i className="fas fa-plus-circle"></i>
                          Add Shift
                        </button>
                        <small style={{color: '#64748b', fontSize: '12px', display: 'block', marginTop: '6px'}}>
                          Shifts split attendance across departments using a single check-in and check-out.
                        </small>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable view of shifts for department heads (only their departments) */}
                {currentUser?.role?.name === "attendanceDepartment" && formData.shifts && formData.shifts.length > 0 && (() => {
                  // Get departments the current user manages
                  const managedDepartmentIds = getFilteredDepartments().map(d => String(d._id));
                  
                  // Filter shifts to only show those from departments the user manages
                  const managedShifts = formData.shifts
                    .map((shift, originalIndex) => ({...shift, originalIndex}))
                    .filter(shift => {
                      const shiftDeptId = String(shift.department?._id || shift.department);
                      return managedDepartmentIds.includes(shiftDeptId);
                    });

                  if (managedShifts.length === 0) {
                    return null; // Don't show section if no managed shifts
                  }

                  return (
                    <div className="form-group full-width">
                      <label>Department Shifts (Your Departments)</label>
                      <div style={{marginTop: '8px'}}>
                        {managedShifts.map((shift) => {
                          const index = shift.originalIndex;
                          const shiftDeptId = String(shift.department?._id || shift.department);
                          const dept = departments.find(d => String(d._id) === shiftDeptId);
                          const deptName = dept?.name || 'Unknown Department';
                          const deptCode = dept?.code || '';
                          
                          return (
                            <div
                              key={`shift-editable-${index}`}
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '10px',
                                background: '#f9fafb',
                                opacity: shift.isActive !== false ? 1 : 0.6,
                              }}
                            >
                              {/* Department Name (readonly) */}
                              <div style={{marginBottom: '12px', padding: '8px', background: '#dbeafe', borderRadius: '6px'}}>
                                <label style={{fontSize: '12px', color: '#1e40af', display: 'block', marginBottom: '2px', fontWeight: '600'}}>
                                  Department
                                </label>
                                <div style={{fontWeight: '600', color: '#1e3a8a'}}>
                                  {deptName} {deptCode && `(${deptCode})`}
                                </div>
                              </div>

                              {/* Editable timing fields */}
                              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px'}}>
                                <div>
                                  <label style={{fontSize: '12px', color: '#374151', display: 'block', marginBottom: '4px', fontWeight: '500'}}>
                                    Start Time *
                                  </label>
                                  <input
                                    type="time"
                                    value={shift.startTime || ''}
                                    onChange={(e) => {
                                      const updated = [...formData.shifts];
                                      updated[index].startTime = e.target.value;
                                      setFormData({...formData, shifts: updated});
                                    }}
                                    style={{width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                  />
                                </div>
                                <div>
                                  <label style={{fontSize: '12px', color: '#374151', display: 'block', marginBottom: '4px', fontWeight: '500'}}>
                                    End Time *
                                  </label>
                                  <input
                                    type="time"
                                    value={shift.endTime || ''}
                                    onChange={(e) => {
                                      const updated = [...formData.shifts];
                                      updated[index].endTime = e.target.value;
                                      setFormData({...formData, shifts: updated});
                                    }}
                                    style={{width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                  />
                                </div>
                              </div>

                              {/* Department-specific details (editable) */}
                              <div style={{marginBottom: '12px', padding: '10px', background: '#fefce8', borderRadius: '6px', border: '1px solid #fef08a'}}>
                                <label style={{fontSize: '12px', color: '#854d0e', display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                                  <i className="fas fa-briefcase"></i> Department-Specific Details
                                </label>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                                  <div>
                                    <label style={{fontSize: '11px', color: '#92400e', display: 'block', marginBottom: '4px', fontWeight: '500'}}>Position</label>
                                    <input
                                      type="text"
                                      value={shift.position || ''}
                                      onChange={(e) => {
                                        const updated = [...formData.shifts];
                                        updated[index].position = e.target.value;
                                        setFormData({...formData, shifts: updated});
                                      }}
                                      placeholder="e.g., Teacher"
                                      style={{width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                    />
                                  </div>
                                  <div>
                                    <label style={{fontSize: '11px', color: '#92400e', display: 'block', marginBottom: '4px', fontWeight: '500'}}>Monthly Salary</label>
                                    <input
                                      type="number"
                                      value={shift.monthlySalary || ''}
                                      onChange={(e) => {
                                        const updated = [...formData.shifts];
                                        updated[index].monthlySalary = parseFloat(e.target.value) || 0;
                                        setFormData({...formData, shifts: updated});
                                      }}
                                      placeholder="0"
                                      style={{width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                    />
                                  </div>
                                  <div>
                                    <label style={{fontSize: '11px', color: '#92400e', display: 'block', marginBottom: '4px', fontWeight: '500'}}>Leave Threshold</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={shift.leaveThreshold !== undefined ? shift.leaveThreshold : ''}
                                      onChange={(e) => {
                                        const updated = [...formData.shifts];
                                        updated[index].leaveThreshold = parseInt(e.target.value) || 0;
                                        setFormData({...formData, shifts: updated});
                                      }}
                                      placeholder="0 per month"
                                      style={{width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                    />
                                  </div>
                                  <div>
                                    <label style={{fontSize: '11px', color: '#92400e', display: 'block', marginBottom: '4px', fontWeight: '500'}}>Joining Date</label>
                                    <input
                                      type="date"
                                      value={shift.joiningDate ? shift.joiningDate.split('T')[0] : ''}
                                      onChange={(e) => {
                                        const updated = [...formData.shifts];
                                        updated[index].joiningDate = e.target.value;
                                        setFormData({...formData, shifts: updated});
                                      }}
                                      style={{width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Editable days of week */}
                              <div style={{marginBottom: '12px'}}>
                                <label style={{fontSize: '12px', color: '#374151', display: 'block', marginBottom: '6px', fontWeight: '500'}}>
                                  Days of Week
                                </label>
                                <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                    <label
                                      key={`shift-${index}-day-${day}`}
                                      style={{
                                        padding: '6px 10px',
                                        background: (shift.daysOfWeek || []).includes(day) ? '#0369a1' : '#e5e7eb',
                                        color: (shift.daysOfWeek || []).includes(day) ? '#fff' : '#6b7280',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(shift.daysOfWeek || []).includes(day)}
                                        onChange={(e) => {
                                          const updated = [...formData.shifts];
                                          const currentDays = updated[index].daysOfWeek || [];
                                          if (e.target.checked) {
                                            updated[index].daysOfWeek = [...currentDays, day];
                                          } else {
                                            updated[index].daysOfWeek = currentDays.filter(d => d !== day);
                                          }
                                          setFormData({...formData, shifts: updated});
                                        }}
                                        style={{display: 'none'}}
                                      />
                                      {day.substring(0, 3)}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Editable day-specific schedules */}
                              <div style={{marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px'}}>
                                <label style={{fontSize: '12px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: '500'}}>
                                  <i className="fas fa-calendar-day"></i>
                                  Day-Specific Schedules (Optional)
                                </label>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                                  const daySchedule = shift.daySchedules?.[day];
                                  const hasSchedule = Boolean(daySchedule);
                                  
                                  return (
                                    <div
                                      key={`shift-${index}-dayschedule-${day}`}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '6px',
                                        background: hasSchedule ? '#f0f9ff' : 'transparent',
                                        borderRadius: '4px',
                                        marginBottom: '4px',
                                      }}
                                    >
                                      <label style={{width: '80px', fontSize: '12px', fontWeight: hasSchedule ? '600' : '400'}}>
                                        <input
                                          type="checkbox"
                                          checked={hasSchedule}
                                          onChange={(e) => {
                                            const updated = [...formData.shifts];
                                            if (!updated[index].daySchedules) {
                                              updated[index].daySchedules = {};
                                            }
                                            if (e.target.checked) {
                                              updated[index].daySchedules[day] = {startTime: shift.startTime || '', endTime: shift.endTime || ''};
                                            } else {
                                              delete updated[index].daySchedules[day];
                                            }
                                            setFormData({...formData, shifts: updated});
                                          }}
                                          style={{marginRight: '4px'}}
                                        />
                                        {day.substring(0, 3)}
                                      </label>
                                      {hasSchedule && (
                                        <>
                                          <input
                                            type="time"
                                            value={daySchedule.startTime || ''}
                                            onChange={(e) => {
                                              const updated = [...formData.shifts];
                                              updated[index].daySchedules[day].startTime = e.target.value;
                                              setFormData({...formData, shifts: updated});
                                            }}
                                            style={{width: '90px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                          />
                                          <span style={{fontSize: '12px', color: '#6b7280'}}>to</span>
                                          <input
                                            type="time"
                                            value={daySchedule.endTime || ''}
                                            onChange={(e) => {
                                              const updated = [...formData.shifts];
                                              updated[index].daySchedules[day].endTime = e.target.value;
                                              setFormData({...formData, shifts: updated});
                                            }}
                                            style={{width: '90px', padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                          />
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {shift.isActive === false && (
                                <div style={{marginTop: '8px', color: '#ef4444', fontSize: '12px', fontWeight: '500'}}>
                                  <i className="fas fa-info-circle"></i> This shift is inactive
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <small style={{color: '#64748b', fontSize: '12px', display: 'block', marginTop: '6px'}}>
                          <i className="fas fa-info-circle"></i> You can edit all shift details for your departments. Only superAdmin can add/remove shifts or change department assignments.
                        </small>
                      </div>
                    </div>
                  );
                })()}

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

                {(!formData.shifts || formData.shifts.length === 0) && (
                  <>
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
                  </>
                )}
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

              {/* Only show Work Schedule, Weekly Offs and Day-Specific Schedules if no department shifts are configured */}
              {(!formData.shifts || formData.shifts.length === 0) && (
                <>
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

                  {/* Day-Specific Schedules Section */}
                  <div className="form-group" style={{padding: '0 29px', marginTop: '20px'}}>
                    <label style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <i className="fas fa-calendar-alt"></i>
                      Day-Specific Schedules (Optional)
                      <small style={{fontWeight: 'normal', color: '#64748b'}}> - Override default times for specific days</small>
                    </label>
                    
                    <div style={{marginTop: '12px'}}>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                        const isWeeklyOff = formData.workSchedule.weeklyOffs.includes(day);
                        const hasDaySchedule = formData.workSchedule.daySchedules && formData.workSchedule.daySchedules[day];
                        const daySchedule = hasDaySchedule ? formData.workSchedule.daySchedules[day] : null;
                        
                        return (
                          <div key={day} style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '8px',
                            backgroundColor: isWeeklyOff ? '#f9fafb' : hasDaySchedule ? '#f0f9ff' : '#fff'
                          }}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasDaySchedule ? '12px' : '0'}}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                <strong style={{minWidth: '100px', color: isWeeklyOff ? '#9ca3af' : '#1f2937'}}>{day}</strong>
                                {isWeeklyOff && <span style={{fontSize: '12px', color: '#6b7280', fontStyle: 'italic'}}>(Weekly Off)</span>}
                                {!isWeeklyOff && !hasDaySchedule && (
                                  <span style={{fontSize: '12px', color: '#6b7280'}}>
                                    Uses default: {formData.workSchedule.checkInTime} - {formData.workSchedule.checkOutTime}
                                  </span>
                                )}
                              </div>
                              {!isWeeklyOff && (
                                hasDaySchedule ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDaySchedule(day)}
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '12px',
                                      background: '#ef4444',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <i className="fas fa-times"></i> Remove
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddDaySchedule(day)}
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '12px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <i className="fas fa-plus"></i> Custom Schedule
                                  </button>
                                )
                              )}
                            </div>
                            
                            {hasDaySchedule && (
                              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginTop: '8px'}}>
                                <div>
                                  <label style={{fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block'}}>Check-in</label>
                                  <input
                                    type="time"
                                    value={daySchedule.checkInTime}
                                    onChange={(e) => handleDayScheduleChange(day, 'checkInTime', e.target.value)}
                                    style={{width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                    disabled={daySchedule.isOff}
                                  />
                                </div>
                                <div>
                                  <label style={{fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block'}}>Check-out</label>
                                  <input
                                    type="time"
                                    value={daySchedule.checkOutTime}
                                    onChange={(e) => handleDayScheduleChange(day, 'checkOutTime', e.target.value)}
                                    style={{width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db'}}
                                    disabled={daySchedule.isOff}
                                  />
                                </div>
                                <div>
                                  <label style={{fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block'}}>Half Day</label>
                                  <input
                                    type="checkbox"
                                    checked={daySchedule.isHalfDay}
                                    onChange={(e) => handleDayScheduleChange(day, 'isHalfDay', e.target.checked)}
                                    style={{marginTop: '8px'}}
                                    disabled={daySchedule.isOff}
                                  />
                                </div>
                                <div>
                                  <label style={{fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block'}}>Is Off</label>
                                  <input
                                    type="checkbox"
                                    checked={daySchedule.isOff}
                                    onChange={(e) => handleDayScheduleChange(day, 'isOff', e.target.checked)}
                                    style={{marginTop: '8px'}}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Info message when department shifts are configured */}
              {formData.shifts && formData.shifts.length > 0 && (
                <div className="form-group" style={{padding: '0 29px'}}>
                  <div style={{
                    background: '#f0f9ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <i className="fas fa-info-circle" style={{color: '#0369a1', fontSize: '18px'}}></i>
                    <div>
                      <strong style={{color: '#0369a1', display: 'block', marginBottom: '4px'}}>
                        Multi-Department Schedule Active
                      </strong>
                      <span style={{fontSize: '13px', color: '#0c4a6e'}}>
                        Position, salary, leave policies, working days, and schedules are managed within each Department Shift configuration above.
                      </span>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Import Employees Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <h2>
                <i className="fas fa-file-upload"></i> Import Employees from Excel
              </h2>
              <button className="close-btn" onClick={() => setShowImportModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "#666", marginBottom: "15px" }}>
                  <i className="fas fa-info-circle"></i> Import multiple employees at once using an Excel file.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDownloadTemplate}
                  style={{ width: "100%", marginBottom: "15px" }}
                >
                  <i className="fas fa-download"></i> Download Template
                </button>
              </div>

              <div className="form-group">
                <label>
                  <i className="fas fa-file-excel"></i> Select Excel File (.xlsx)
                </label>
                <input
                  id="excelFileInput"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  style={{
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    width: "100%",
                  }}
                />
                {importFile && (
                  <small style={{ color: "#10b981", display: "block", marginTop: "5px" }}>
                    <i className="fas fa-check-circle"></i> Selected: {importFile.name}
                  </small>
                )}
              </div>

              {importResults && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "15px",
                    borderRadius: "8px",
                    backgroundColor: "#f0f9ff",
                    border: "1px solid #bae6fd",
                  }}
                >
                  <h4 style={{ marginTop: 0, color: "#0369a1" }}>
                    <i className="fas fa-chart-bar"></i> Import Results
                  </h4>
                  <div style={{ marginBottom: "10px" }}>
                    <strong>Total:</strong> {importResults.total} rows
                  </div>
                  <div style={{ marginBottom: "10px", color: "#10b981" }}>
                    <strong>Successful:</strong> {importResults.successful} employees created
                  </div>
                  <div style={{ marginBottom: "10px", color: "#ef4444" }}>
                    <strong>Failed:</strong> {importResults.failed} rows
                  </div>

                  {importResults.failed > 0 && importResults.details?.failed?.length > 0 && (
                    <div style={{ marginTop: "15px" }}>
                      <strong style={{ color: "#ef4444" }}>Failed Rows:</strong>
                      <div
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          marginTop: "10px",
                          padding: "10px",
                          backgroundColor: "#fff",
                          borderRadius: "4px",
                          border: "1px solid #fee2e2",
                        }}
                      >
                        {importResults.details.failed.map((item, idx) => (
                          <div key={idx} style={{ marginBottom: "8px", fontSize: "13px" }}>
                            <strong>Row {item.row}:</strong> {item.name} -{" "}
                            <span style={{ color: "#ef4444" }}>{item.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importResults.successful > 0 && importResults.details?.success?.length > 0 && (
                    <div style={{ marginTop: "15px" }}>
                      <strong style={{ color: "#10b981" }}>Successfully Created:</strong>
                      <div
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          marginTop: "10px",
                          padding: "10px",
                          backgroundColor: "#fff",
                          borderRadius: "4px",
                          border: "1px solid #d1fae5",
                        }}
                      >
                        {importResults.details.success.map((item, idx) => (
                          <div key={idx} style={{ marginBottom: "8px", fontSize: "13px" }}>
                            <strong>Row {item.row}:</strong> {item.name} ({item.employeeId}) -{" "}
                            <span style={{ color: "#10b981" }}>✓ Created</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResults(null);
                    setImportFile(null);
                  }}
                >
                  <i className="fas fa-times"></i> Close
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleImportEmployees}
                  disabled={!importFile || importing}
                >
                  {importing ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Importing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload"></i> Import Employees
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Fields Selection Modal */}
      {showExportFieldsModal && (
        <div className="modal-overlay" onClick={() => setShowExportFieldsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Fields to Export</h2>
              <button 
                type="button" 
                className="close-btn"
                onClick={() => setShowExportFieldsModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="field-selection-container">
                <div className="select-all-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={Object.values(selectedExportFields).every(v => v)}
                      onChange={handleSelectAllExportFields}
                    />
                    <span style={{ marginLeft: '8px', fontWeight: '600' }}>Select All</span>
                  </label>
                </div>
                <div className="fields-grid">
                  {exportFields.map((field) => (
                    <label key={field.key} className="field-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedExportFields[field.key] || false}
                        onChange={() => handleToggleExportField(field.key)}
                      />
                      <span style={{ marginLeft: '8px' }}>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowExportFieldsModal(false)}
              >
                <i className="fas fa-times"></i> Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmExport}
                disabled={exporting || Object.values(selectedExportFields).every(v => !v)}
              >
                <i className={exporting ? "fas fa-spinner fa-spin" : "fas fa-download"}></i>
                {exporting ? ` Exporting to ${exportFormat === 'xlsx' ? 'Excel' : 'CSV'}...` : `Export to ${exportFormat === 'xlsx' ? 'Excel' : 'CSV'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
