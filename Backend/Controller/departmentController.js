import Department from "../Model/Department.js";
import Employee from "../Model/Employee.js";
import { logDepartmentAction } from "../Utils/auditLogger.js";

// Create department
export const createDepartment = async (req, res) => {
  try {
    const { name, code, description, head, leverageTime, teamLead, parentDepartment } = req.body;

    const existingDept = await Department.findOne({
      $or: [{ name }, { code }],
    });

    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: "Department with this name or code already exists",
      });
    }

    // Auto-generate code if not provided
    const deptCode = code ? code.toUpperCase() : name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);

    // Calculate hierarchy level and path
    let level = 0;
    let path = "";
    
    if (parentDepartment) {
      const parent = await Department.findById(parentDepartment);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent department not found",
        });
      }
      level = parent.level + 1;
      path = parent.path ? `${parent.path}/${parent._id}` : `${parent._id}`;
    }

    const department = await Department.create({
      name,
      code: deptCode,
      description,
      head,
      leverageTime,
      teamLead,
      parentDepartment: parentDepartment || null,
      level,
      path,
      createdBy: req.user._id,
    });

    const populatedDept = await Department.findById(department._id)
      .populate("head", "name email")
      .populate("teamLead", "name employeeId email position")
      .populate("parentDepartment", "name code");

    // Audit log
    await logDepartmentAction(req, "CREATE", populatedDept, {
      after: { name: populatedDept.name, code: populatedDept.code }
    });

    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: populatedDept,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all departments
export const getAllDepartments = async (req, res) => {
  try {
    const { flat, parentOnly } = req.query;
    
    let query = { isActive: true };
    
    // If parentOnly=true, get only root departments
    if (parentOnly === 'true') {
      query.parentDepartment = null;
    }
    
    const departments = await Department.find(query)
      .populate("head", "name email employeeId")
      .populate("teamLead", "name employeeId email position")
      .populate("parentDepartment", "name code")
      .populate("createdBy", "name employeeId")
      .sort({ level: 1, name: 1 });

    // If flat=false (default), return hierarchical structure
    if (flat !== 'true') {
      // Build hierarchical tree
      const deptMap = new Map();
      const rootDepts = [];
      
      // First pass: create map
      departments.forEach(dept => {
        deptMap.set(dept._id.toString(), { ...dept.toObject(), children: [] });
      });
      
      // Second pass: build tree
      departments.forEach(dept => {
        const deptObj = deptMap.get(dept._id.toString());
        if (dept.parentDepartment) {
          // Handle both populated object and ObjectId
          const parentId = dept.parentDepartment._id 
            ? dept.parentDepartment._id.toString() 
            : dept.parentDepartment.toString();
          const parentObj = deptMap.get(parentId);
          if (parentObj) {
            parentObj.children.push(deptObj);
          } else {
            rootDepts.push(deptObj);
          }
        } else {
          rootDepts.push(deptObj);
        }
      });

      res.status(200).json({
        success: true,
        count: departments.length,
        data: rootDepts,
        flatData: departments, // Also include flat list for dropdowns
      });
    } else {
      res.status(200).json({
        success: true,
        count: departments.length,
        data: departments,
      });
    }
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get department by ID
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate("head", "name email phone")
      .populate("teamLead", "name employeeId email position phone")
      .populate("parentDepartment", "name code")
      .populate("createdBy", "name");

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // Get sub-departments
    const subDepartments = await Department.find({
      parentDepartment: req.params.id,
      isActive: true,
    }).populate("head", "name email").populate("teamLead", "name employeeId");

    // Get full hierarchy path (ancestors)
    let ancestors = [];
    if (department.path) {
      const ancestorIds = department.path.split('/').filter(Boolean);
      ancestors = await Department.find({
        _id: { $in: ancestorIds }
      }).select("name code level").sort({ level: 1 });
    }

    res.status(200).json({
      success: true,
      data: {
        ...department.toObject(),
        subDepartments,
        ancestors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update department
export const updateDepartment = async (req, res) => {
  try {
    const { name, code, description, head, isActive, leverageTime, teamLead, parentDepartment } = req.body;

    const currentDept = await Department.findById(req.params.id);
    if (!currentDept) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const updateData = { name, description, head, isActive, leverageTime, teamLead };
    if (code) updateData.code = code.toUpperCase();

    // Get current parent ID as string for comparison
    const currentParentId = currentDept.parentDepartment 
      ? currentDept.parentDepartment.toString() 
      : null;
    
    // Normalize incoming parentDepartment (empty string becomes null)
    const newParentId = parentDepartment && parentDepartment !== "" ? parentDepartment : null;

    // Handle parent department change
    if (newParentId !== currentParentId) {
      // Prevent circular reference
      if (newParentId === req.params.id) {
        return res.status(400).json({
          success: false,
          message: "A department cannot be its own parent",
        });
      }

      if (newParentId) {
        const parent = await Department.findById(newParentId);
        if (!parent) {
          return res.status(400).json({
            success: false,
            message: "Parent department not found",
          });
        }
        
        // Check if the new parent is a child of current department (prevent circular)
        if (parent.path && parent.path.includes(req.params.id)) {
          return res.status(400).json({
            success: false,
            message: "Cannot set a child department as parent (circular reference)",
          });
        }
        
        updateData.parentDepartment = newParentId;
        updateData.level = parent.level + 1;
        updateData.path = parent.path ? `${parent.path}/${parent._id}` : `${parent._id}`;
      } else {
        updateData.parentDepartment = null;
        updateData.level = 0;
        updateData.path = "";
      }

      // Update all child departments' paths recursively
      await updateChildPaths(req.params.id, updateData.path || "", updateData.level || 0);
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("head", "name email")
      .populate("teamLead", "name employeeId email position")
      .populate("parentDepartment", "name code");

    // Audit log
    await logDepartmentAction(req, "UPDATE", department, {
      before: { name: currentDept.name, code: currentDept.code },
      after: { name: department.name, code: department.code }
    });

    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function to update child department paths
async function updateChildPaths(parentId, parentPath, parentLevel) {
  const children = await Department.find({ parentDepartment: parentId });
  
  for (const child of children) {
    const newPath = parentPath ? `${parentPath}/${parentId}` : `${parentId}`;
    const newLevel = parentLevel + 1;
    
    await Department.findByIdAndUpdate(child._id, {
      path: newPath,
      level: newLevel,
    });
    
    // Recursively update grandchildren
    await updateChildPaths(child._id, newPath, newLevel);
  }
}

// Delete department
export const deleteDepartment = async (req, res) => {
  try {
    // Check if department has active sub-departments
    const hasChildren = await Department.exists({
      parentDepartment: req.params.id,
      isActive: true,
    });

    if (hasChildren) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete department with active sub-departments. Delete or reassign sub-departments first.",
      });
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // Audit log
    await logDepartmentAction(req, "DELETE", department, {
      before: { name: department.name, code: department.code, isActive: true },
      after: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get sub-departments of a department
export const getSubDepartments = async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { lazyLoad } = req.query;
    
    // Get direct children
    const directChildren = await Department.find({
      parentDepartment: departmentId,
      isActive: true,
    })
      .populate("head", "name email")
      .populate("teamLead", "name employeeId")
      .sort({ name: 1 });

    // For lazy loading, add hasChildren flag to each child
    if (lazyLoad === "true") {
      const childrenWithFlags = await Promise.all(
        directChildren.map(async (dept) => {
          const childCount = await Department.countDocuments({
            parentDepartment: dept._id,
            isActive: true,
          });
          const employeeCount = await Employee.countDocuments({
            department: dept._id,
            isActive: true,
          });
          return {
            ...dept.toObject(),
            hasChildren: childCount > 0,
            childCount,
            employeeCount,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: childrenWithFlags,
      });
    }

    // Get all descendants (children, grandchildren, etc.)
    const allDescendants = await Department.find({
      path: { $regex: departmentId },
      isActive: true,
    })
      .populate("head", "name email")
      .sort({ level: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: {
        directChildren,
        allDescendants,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get team leads for a department
export const getDepartmentTeamLeads = async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Find employees who are leading this department
    const teamLeads = await Employee.find({
      leadingDepartments: departmentId,
      isActive: true,
    }).select("name employeeId email position phone");

    res.status(200).json({
      success: true,
      count: teamLeads.length,
      data: teamLeads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all employees in a department (primary + additional)
export const getDepartmentEmployees = async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Find employees where this dept is primary or additional
    const employees = await Employee.find({
      $or: [
        { department: departmentId },
        { additionalDepartments: departmentId }
      ],
      isActive: true,
    })
      .populate("department", "name code")
      .populate("role", "name")
      .select("name employeeId email position phone department role isTeamLead leadingDepartments");

    // Mark which ones are primary vs additional
    const enrichedEmployees = employees.map(emp => {
      const empObj = emp.toObject();
      empObj.isPrimaryDepartment = emp.department?._id?.toString() === departmentId;
      empObj.isLeadingThisDept = emp.leadingDepartments?.some(d => d?.toString() === departmentId);
      return empObj;
    });

    res.status(200).json({
      success: true,
      count: enrichedEmployees.length,
      data: enrichedEmployees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
