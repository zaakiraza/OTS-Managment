import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../Model/Role.js";
import Employee from "../Model/Employee.js";
import Department from "../Model/Department.js";
import logger from "./logger.js";

dotenv.config();

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGOURI);
    console.log("Database connected");

    // Check if roles already exist
    const existingRoles = await Role.find();
    if (existingRoles.length > 0) {
      console.log("Roles already exist. Skipping role seed...");
    } else {
      // Create roles
      const roles = await Role.insertMany([
        {
          name: "superAdmin",
          description: "Super Administrator with full access to all features",
          permissions: [
            "manage_users",
            "manage_roles",
            "manage_attendance",
            "manage_assets",
            "view_reports",
            "system_settings",
          ],
        },
        {
          name: "attendanceDepartment",
          description: "Attendance Department staff with limited access",
          permissions: ["manage_attendance", "view_reports"],
        },
        {
          name: "ITAssetManager",
          description: "IT Asset Manager with asset management access",
          permissions: ["manage_assets", "view_reports"],
        },
        {
          name: "teamLead",
          description: "Team Lead with task management access",
          permissions: ["manage_tasks", "view_reports"],
        },
        {
          name: "employee",
          description: "Regular employee with basic access",
          permissions: ["view_own_tasks", "update_own_tasks"],
        },
      ]);
      console.log("Roles created successfully");
    }

    // Check if superAdmin already exists
    const superAdminRole = await Role.findOne({ name: "superAdmin" });
    const existingAdmin = await Employee.findOne({ 
      role: superAdminRole._id 
    });

    if (existingAdmin) {
      console.log("SuperAdmin already exists. Skipping admin seed...");
      process.exit(0);
    }

    // Create or find Administration department
    let adminDept = await Department.findOne({ code: "ADMIN" });
    if (!adminDept) {
      // We need to create a temporary ObjectId for createdBy since we don't have an admin yet
      const tempId = new mongoose.Types.ObjectId();
      adminDept = await Department.create({
        name: "Administration",
        code: "ADMIN",
        description: "System administrators and management",
        createdBy: tempId, // Will be updated after admin is created
      });
      console.log("Administration department created");
    }

    // Create a default superAdmin employee
    const superAdmin = await Employee.create({
      employeeId: "SADM0001",
      name: "Super Admin",
      email: "admin@organization.com",
      phone: "1234567890",
      password: "12345678",
      role: superAdminRole._id,
      department: adminDept._id,
      position: "System Administrator",
      isTeamLead: true,
      workSchedule: {
        checkInTime: "09:00",
        checkOutTime: "17:00",
        workingDaysPerWeek: 5,
        workingHoursPerWeek: 40,
        weeklyOffs: ["Saturday", "Sunday"],
      },
    });

    // Update the department's createdBy to the new admin
    await Department.findByIdAndUpdate(adminDept._id, {
      createdBy: superAdmin._id,
    });

    console.log("\n✅ SuperAdmin employee created successfully:");
    console.log("   Employee ID: SADM0001");
    console.log("   Email: admin@organization.com");
    console.log("   Password: 12345678");
    console.log("\n⚠️  Please change this password after first login!");

    process.exit(0);
  } catch (error) {
    logger.error(`Error seeding roles: ${error.message}`, { stack: error.stack });
    console.error("Error:", error.message);
    process.exit(1);
  }
};

seedRoles();
