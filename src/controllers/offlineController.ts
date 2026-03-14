// src/controllers/offlineController.ts
// export const syncOfflineData = async (req: any, res: any) => {
//   const { punches, locations, tasks } = req.body; // Arrays from local storage
//   const userId = req.user._id;
//   try {
//     // Validate & save in batch
//     const savedPunches = await Punch.insertMany(punches.map((p: any) => ({ ...p, user: userId })));
//     // Similar for locations, tasks
//     // Log offline duration
//     res.json({ saved: { punches: savedPunches.length } });
//   } catch (error) { console.error(error); }
// };
// Route: POST /api/offline/sync (protect, employee)