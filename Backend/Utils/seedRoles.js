import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "../Model/Role.js";
import User from "../Model/User.js";

dotenv.config();

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGOURI);
    // console.log("Database connected");

    // Check if roles already exist
    const existingRoles = await Role.find();
    if (existingRoles.length > 0) {
      // console.log("Roles already exist. Skipping seed...");
      process.exit(0);
    }

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
        name: "assetManager",
        description: "IT Asset Manager with asset management access",
        permissions: ["manage_assets", "view_reports"],
      },
    ]);

    // console.log("Roles created successfully:", roles);

    // Create a default superAdmin user
    const superAdminRole = roles.find((r) => r.name === "superAdmin");
    
    const superAdmin = await User.create({
      name: "Super Admin",
      userId: "ADMIN001",
      email: "admin@organization.com",
      phone: "1234567890",
      password: "admin123",
      role: superAdminRole._id,
    });

    // console.log("SuperAdmin user created successfully:");
    // console.log("Email: admin@organization.com");
    // console.log("Password: admin123");
    // console.log("\n⚠️  Please change this password after first login!");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding roles:", error);
    process.exit(1);
  }
};

seedRoles();
