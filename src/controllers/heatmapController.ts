import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import LocationLog from "../models/locationlogs";
import { haversineDistance } from "../utils/healper";

const CLUSTER_RADIUS_METERS = 150; // GPS points within 150m = same location
const MIN_PINGS_TO_SHOW = 3;       // ignore locations with very few pings (just passing by)

interface Cluster {
    lat: number;
    lng: number;
    address?: string;
    totalPings: number;
    pointCount: number;
    userMap: Map<string, { name: string; pings: number }>;
}

export const getHeatmapData = async (req: AuthRequest, res: Response) => {
    try {
        const { period = "today" } = req.query;

        const now = new Date();
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        if (period === "week") {
            startDate.setDate(now.getDate() - 7);
        } else if (period === "month") {
            startDate.setMonth(now.getMonth() - 1);
        }

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        // Fetch all location logs for the period with user name
        const logs = await LocationLog.find({
            timestamp: { $gte: startDate, $lte: endDate }
        }).populate("user", "name").lean();

        // Greedy clustering — group nearby GPS points into one location
        const clusters: Cluster[] = [];

        for (const log of logs) {
            if (!log.location?.lat || !log.location?.lng) continue;
            const user: any = log.user;
            if (!user) continue;

            const { lat, lng } = log.location;

            // Find nearest existing cluster within radius
            let nearestCluster: Cluster | null = null;
            let minDist = Infinity;

            for (const cluster of clusters) {
                const distMeters = haversineDistance(cluster.lat, cluster.lng, lat, lng) * 1000;
                if (distMeters <= CLUSTER_RADIUS_METERS && distMeters < minDist) {
                    minDist = distMeters;
                    nearestCluster = cluster;
                }
            }

            if (nearestCluster) {
                // Update running average of cluster center
                nearestCluster.pointCount++;
                nearestCluster.lat =
                    (nearestCluster.lat * (nearestCluster.pointCount - 1) + lat) / nearestCluster.pointCount;
                nearestCluster.lng =
                    (nearestCluster.lng * (nearestCluster.pointCount - 1) + lng) / nearestCluster.pointCount;
                nearestCluster.totalPings++;

                // Keep first available address
                if (!nearestCluster.address && log.location.address) {
                    nearestCluster.address = log.location.address;
                }

                const userId = user._id.toString();
                const existing = nearestCluster.userMap.get(userId);
                if (existing) {
                    existing.pings++;
                } else {
                    nearestCluster.userMap.set(userId, { name: user.name, pings: 1 });
                }
            } else {
                // Start a new cluster
                clusters.push({
                    lat,
                    lng,
                    address: log.location.address,
                    totalPings: 1,
                    pointCount: 1,
                    userMap: new Map([[user._id.toString(), { name: user.name, pings: 1 }]])
                });
            }
        }

        // Filter noise, sort by hottest first, format response
        const heatmapData = clusters
            .filter(c => c.totalPings >= MIN_PINGS_TO_SHOW)
            .sort((a, b) => b.totalPings - a.totalPings)
            .map(cluster => {
                const employees = Array.from(cluster.userMap.values())
                    .sort((a, b) => b.pings - a.pings)
                    .map(e => ({ name: e.name, visits: e.pings }));

                let coverage: "High" | "Medium" | "Low" = "Low";
                let color = "bg-blue-100 text-blue-700 border-blue-200";

                if (cluster.totalPings >= 50) {
                    coverage = "High";
                    color = "bg-red-100 text-red-700 border-red-200";
                } else if (cluster.totalPings >= 20) {
                    coverage = "Medium";
                    color = "bg-orange-100 text-orange-700 border-orange-200";
                }

                return {
                    lat: parseFloat(cluster.lat.toFixed(6)),
                    lng: parseFloat(cluster.lng.toFixed(6)),
                    address: cluster.address ?? null,
                    totalVisits: cluster.totalPings,
                    uniqueVisitors: cluster.userMap.size,
                    coverage,
                    color,
                    employees  // [{ name, visits }] sorted by most visits
                };
            });

        res.status(200).json({
            success: true,
            data: heatmapData
        });

    } catch (error) {
        console.error("Heatmap data error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
