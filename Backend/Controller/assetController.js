import Asset from "../Model/Asset.js";
import AssetAssignment from "../Model/AssetAssignment.js";
import Employee from "../Model/Employee.js";
import { logAssetAction, logImportAction } from "../Utils/auditLogger.js";
import { createNotification } from "./notificationController.js";
import { uploadBase64ToS3 } from "../Config/s3.js";

// Get all assets
export const getAllAssets = async (req, res) => {
  try {
    const { status, category, assignedTo, search } = req.query;
    const filter = { isActive: true };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    if (search) {
      filter.$or = [
        { assetId: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const assets = await Asset.find(filter)
      .populate({
        path: "assignedTo",
        select: "employeeId name email department",
        populate: {
          path: "department",
          select: "name"
        }
      })
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get asset by ID
export const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate("assignedTo", "employeeId name email department position")
      .populate("createdBy", "name")
      .populate("modifiedBy", "name");

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    res.status(200).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create new asset
export const createAsset = async (req, res) => {
  try {
    // Clean up the location object - remove any extra fields
    const locationData = req.body.location ? {
      building: req.body.location.building || "",
      floor: req.body.location.floor || "",
    } : undefined;

    // Handle image upload to S3
    let imageUrls = [];
    if (req.body.images && req.body.images.length > 0) {
      for (const image of req.body.images) {
        // Check if it's base64 data
        if (image && image.startsWith('data:image')) {
          try {
            const uploadResult = await uploadBase64ToS3(
              image,
              'assets',
              `asset-${Date.now()}.jpg`
            );
            imageUrls.push(uploadResult.path);
          } catch (uploadError) {
            console.error("Error uploading image to S3:", uploadError);
            // Continue without the image if upload fails
          }
        } else if (image && image.startsWith('http')) {
          // Already a URL, keep it
          imageUrls.push(image);
        }
      }
    }

    const assetData = {
      ...req.body,
      images: imageUrls,
      location: locationData,
      createdBy: req.user._id,
    };

    const asset = await Asset.create(assetData);

    // Audit log
    await logAssetAction(req, "CREATE", asset, {
      after: { name: asset.name, category: asset.category, status: asset.status }
    });

    res.status(201).json({
      success: true,
      message: "Asset created successfully",
      data: asset,
    });
  } catch (error) {
    console.error("Asset creation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk create assets (import from Excel/CSV)
export const bulkCreateAssets = async (req, res) => {
  try {
    const assetsData = req.body;
    
    if (!Array.isArray(assetsData) || assetsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No assets data provided",
      });
    }

    const results = {
      created: 0,
      errors: [],
    };

    // Process each asset
    for (let i = 0; i < assetsData.length; i++) {
      const assetData = assetsData[i];
      
      try {
        // Clean up location data
        const locationData = assetData.location ? {
          building: assetData.location.building || "",
          floor: assetData.location.floor || "",
        } : undefined;

        // Create asset
        const asset = await Asset.create({
          name: assetData.name,
          category: assetData.category,
          serialNumber: assetData.serialNumber || null,
          macAddress: assetData.macAddress || null,
          condition: assetData.condition || "Good",
          status: assetData.status || "Available",
          purchasePrice: assetData.purchasePrice || null,
          issueDate: assetData.issueDate || new Date(),
          location: locationData,
          notes: assetData.notes || "",
          createdBy: req.user._id,
        });

        results.created++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          name: assetData.name,
          error: error.message,
        });
      }
    }

    // Audit log for bulk import
    await logImportAction(req, "Asset", `Bulk imported ${results.created} assets`, {
      after: { created: results.created, errors: results.errors.length }
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${results.created} assets`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk asset creation error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update asset
export const updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    // Handle image upload to S3
    let imageUrls = [];
    if (req.body.images && req.body.images.length > 0) {
      for (const image of req.body.images) {
        // Check if it's base64 data
        if (image && image.startsWith('data:image')) {
          try {
            const uploadResult = await uploadBase64ToS3(
              image,
              'assets',
              `asset-${Date.now()}.jpg`
            );
            imageUrls.push(uploadResult.path);
          } catch (uploadError) {
            console.error("Error uploading image to S3:", uploadError);
          }
        } else if (image && image.startsWith('http')) {
          // Already a URL, keep it
          imageUrls.push(image);
        }
      }
      req.body.images = imageUrls;
    }

    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        modifiedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    // Audit log
    await logAssetAction(req, "UPDATE", updatedAsset, {
      before: { name: asset.name, status: asset.status, condition: asset.condition },
      after: { name: updatedAsset.name, status: updatedAsset.status, condition: updatedAsset.condition }
    });

    res.status(200).json({
      success: true,
      message: "Asset updated successfully",
      data: updatedAsset,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete asset (soft delete)
export const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    await Asset.findByIdAndUpdate(req.params.id, {
      isActive: false,
      modifiedBy: req.user._id,
    });

    // Audit log
    await logAssetAction(req, "DELETE", asset, {
      before: { name: asset.name, isActive: true },
      after: { isActive: false }
    });

    res.status(200).json({
      success: true,
      message: "Asset deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Assign asset to employee
export const assignAsset = async (req, res) => {
  try {
    const { assetId, employeeId, conditionAtAssignment, notes, quantityToAssign, room } = req.body;
    const trimmedRoom = room?.trim();

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      });
    }

    // Calculate available quantity
    const availableQuantity = asset.quantity - (asset.quantityAssigned || 0);
    const assignQuantity = parseInt(quantityToAssign) || 1;

    // Check if enough quantity is available
    if (assignQuantity > availableQuantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableQuantity} unit(s) available. Cannot assign ${assignQuantity} unit(s).`,
      });
    }

    if (assignQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity to assign must be at least 1",
      });
    }

    if (!employeeId && !trimmedRoom) {
      return res.status(400).json({
        success: false,
        message: "Assign to an employee or provide a room.",
      });
    }

    let employee = null;
    if (employeeId) {
      employee = await Employee.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }
    }

    // Create assignment record
    const assignment = await AssetAssignment.create({
      asset: assetId,
      employee: employee ? employee._id : undefined,
      quantity: assignQuantity,
      assignedBy: req.user._id,
      conditionAtAssignment: conditionAtAssignment || asset.condition,
      room: trimmedRoom,
      notes,
      status: "Active",
    });

    // Update asset - increment quantityAssigned
    asset.quantityAssigned = (asset.quantityAssigned || 0) + assignQuantity;
    
    // Update status based on availability
    const newAvailable = asset.quantity - asset.quantityAssigned;
    if (newAvailable === 0) {
      asset.status = "Assigned"; // Fully assigned
    } else if (asset.quantityAssigned > 0) {
      asset.status = "Assigned"; // Partially or fully assigned
    }
    
    asset.modifiedBy = req.user._id;
    await asset.save();

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate("asset")
      .populate("employee", "employeeId name email")
      .populate("assignedBy", "name");

    // Audit log
    await logAssetAction(req, "ASSIGN", asset, {
      after: { 
        assignedTo: employee?.name || null, 
        employeeId: employee?.employeeId || null,
        room: trimmedRoom || null,
        quantity: assignQuantity,
        availableQuantity: newAvailable
      }
    });

    // Send notification to employee
    if (employeeId) {
      try {
        await createNotification({
          recipient: employeeId,
          type: "asset_assigned",
          title: "Asset Assigned",
          message: `You have been assigned ${assignQuantity} unit(s) of ${asset.name} (${asset.assetId})`,
          data: {
            referenceId: asset._id,
            referenceType: "Asset",
            extra: { assetId: asset.assetId, assetName: asset.name, quantity: assignQuantity },
          },
          sender: req.user._id,
        });
      } catch (notifError) {
        console.error("Error creating asset notification:", notifError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${assignQuantity} unit(s). ${newAvailable} unit(s) remaining.`,
      data: populatedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Return asset from employee
export const returnAsset = async (req, res) => {
  try {
    const { assignmentId, conditionAtReturn, returnNotes, status } = req.body;

    const assignment = await AssetAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    if (assignment.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Assignment is not active",
      });
    }

    const returnQuantity = assignment.quantity || 1;

    // Update assignment
    assignment.returnDate = new Date();
    assignment.returnedBy = req.user._id;
    assignment.conditionAtReturn = conditionAtReturn;
    assignment.returnNotes = returnNotes;
    assignment.status = status || "Returned";
    await assignment.save();

    // Update asset - decrease quantityAssigned
    const asset = await Asset.findById(assignment.asset);
    asset.quantityAssigned = Math.max(0, (asset.quantityAssigned || 0) - returnQuantity);
    
    // Update status based on availability
    const availableQuantity = asset.quantity - asset.quantityAssigned;
    if (asset.quantityAssigned === 0) {
      asset.status = status === "Damaged" ? "Damaged" : "Available";
    } else if (availableQuantity > 0) {
      asset.status = "Available"; // Some quantity available
    }
    
    asset.condition = conditionAtReturn;
    asset.modifiedBy = req.user._id;
    await asset.save();

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate("asset")
      .populate("employee", "employeeId name email")
      .populate("returnedBy", "name");

    // Audit log
    await logAssetAction(req, "UNASSIGN", asset, {
      before: { assignedTo: populatedAssignment.employee?.name },
      after: { 
        status: asset.status, 
        condition: conditionAtReturn,
        returnedQuantity: returnQuantity,
        availableQuantity: availableQuantity
      }
    });

    // Notify employee about asset return confirmation
    try {
      if (populatedAssignment.employee) {
        await createNotification({
          recipient: populatedAssignment.employee._id,
          type: "asset_returned",
          title: "Asset Returned",
          message: `Your return of ${returnQuantity} unit(s) of ${asset.name} (${asset.assetId}) has been processed`,
          data: {
            referenceId: asset._id,
            referenceType: "Asset",
            extra: { assetId: asset.assetId, assetName: asset.name, condition: conditionAtReturn, quantity: returnQuantity },
          },
          sender: req.user._id,
        });
      }
    } catch (notifError) {
      console.error("Error creating asset return notification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: "Asset returned successfully",
      data: populatedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get asset assignment history
export const getAssetHistory = async (req, res) => {
  try {
    const { assetId } = req.params;

    const history = await AssetAssignment.find({ asset: assetId })
      .populate("employee", "employeeId name email")
      .populate("assignedBy", "name")
      .populate("returnedBy", "name")
      .sort({ assignedDate: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get employee assets
export const getEmployeeAssets = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Get all active assignments for this employee
    const assignments = await AssetAssignment.find({
      employee: employeeId,
      status: "Active", // Only active assignments
    })
      .populate({
        path: "asset",
        select: "assetId name category condition status quantity quantityAssigned",
      })
      .populate("assignedBy", "name")
      .sort({ assignedDate: -1 });

    // Transform the data to include asset details with assignment quantity
    const employeeAssets = assignments
      .filter((assignment) => assignment.asset)
      .map((assignment) => ({
        _id: assignment.asset._id,
        assetId: assignment.asset.assetId,
        name: assignment.asset.name,
        category: assignment.asset.category,
        condition: assignment.asset.condition,
        status: assignment.asset.status,
        quantity: assignment.quantity, // Quantity assigned to this employee
        totalQuantity: assignment.asset.quantity,
        assignedDate: assignment.assignedDate,
        assignedBy: assignment.assignedBy?.name,
        conditionAtAssignment: assignment.conditionAtAssignment,
        room: assignment.room,
        notes: assignment.notes,
      }));

    res.status(200).json({
      success: true,
      count: employeeAssets.length,
      data: employeeAssets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get asset statistics
export const getAssetStats = async (req, res) => {
  try {
    const totalAssets = await Asset.countDocuments({ isActive: true });
    const available = await Asset.countDocuments({ status: "Available", isActive: true });
    const assigned = await Asset.countDocuments({ status: "Assigned", isActive: true });
    const underRepair = await Asset.countDocuments({ status: "Under Repair", isActive: true });
    const damaged = await Asset.countDocuments({ status: "Damaged", isActive: true });

    const categoryBreakdown = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const statusBreakdown = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAssets,
        available,
        assigned,
        underRepair,
        damaged,
        categoryBreakdown,
        statusBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get detailed asset analytics with employee distribution
export const getAssetAnalytics = async (req, res) => {
  try {
    // Count total assets by quantity
    const totalAssets = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);

    // Count total assigned quantity
    const totalAssignedByQuantity = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, assigned: { $sum: "$quantityAssigned" } } },
    ]);

    const totalQuantity = totalAssets[0]?.total || 0;
    const totalAssignedQty = totalAssignedByQuantity[0]?.assigned || 0;
    const availableQty = totalQuantity - totalAssignedQty;

    // Asset count breakdown
    const assetCountByStatus = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$status", count: { $sum: 1 }, quantity: { $sum: "$quantity" } } },
    ]);

    // Asset count by category
    const assetsByCategory = await Asset.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", count: { $sum: 1 }, quantity: { $sum: "$quantity" } } },
    ]);

    // Employee-wise asset distribution
    const employeeAssignments = await AssetAssignment.aggregate([
      { $match: { status: "Active" } },
      { $group: { 
          _id: "$employee", 
          totalAssigned: { $sum: "$quantity" },
          itemsCount: { $sum: 1 }
      }},
      { $sort: { totalAssigned: -1 } },
      { $lookup: {
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "employeeDetails"
      }},
      { $unwind: "$employeeDetails" },
      { $project: {
          employeeId: "$employeeDetails.employeeId",
          employeeName: "$employeeDetails.name",
          employeeEmail: "$employeeDetails.email",
          totalAssigned: 1,
          itemsCount: 1
      }}
    ]);

    // Top assets being assigned
    const topAssignedAssets = await Asset.aggregate([
      { $match: { isActive: true, quantityAssigned: { $gt: 0 } } },
      { $sort: { quantityAssigned: -1 } },
      { $project: {
          assetId: 1,
          name: 1,
          quantity: 1,
          quantityAssigned: 1,
          category: 1,
          available: { $subtract: ["$quantity", "$quantityAssigned"] }
      }}
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalQuantity,
          totalAssignedQty,
          availableQty,
          assetCount: await Asset.countDocuments({ isActive: true })
        },
        assetsByStatus: assetCountByStatus,
        assetsByCategory: assetsByCategory,
        employeeAssignments,
        topAssignedAssets,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
