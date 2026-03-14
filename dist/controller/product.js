"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockHistory = exports.getVehiclesStock = exports.getChargersStock = exports.getBatteriesStock = exports.addSoldStockHandler = exports.addStockHandler = exports.createProductHandler = void 0;
const product_1 = __importDefault(require("../model/product"));
const addStock = (updates) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedProducts = [];
    for (const { type, item, quantity, updatedBy, specification, partyName, location } of updates) {
        const product = yield product_1.default.findOne({ type, item });
        if (!product) {
            throw new Error(`Product ${item} not found`);
        }
        const currentStock = Number(product.currentStock);
        const quantityToAdd = Number(quantity);
        // Update the product stock and other fields
        product.currentStock = currentStock + quantityToAdd;
        product.updatedBy = updatedBy;
        product.specification = specification;
        product.partyName = partyName; // Update product with party name if available
        product.location = location; // Update product with location if available
        // Add to stock history with partyName and location
        product.stockHistory.push({
            user: updatedBy,
            quantity,
            action: 'added',
            date: new Date(),
            speci: specification,
            partyName, // Store party name in history
            location, // Store location in history
        });
        yield product.save();
        updatedProducts.push(product);
    }
    return updatedProducts;
});
const addSoldStock = (updates) => __awaiter(void 0, void 0, void 0, function* () {
    const updatedProducts = [];
    for (const { type, item, quantity, updatedBy, specification, partyName, location } of updates) {
        const product = yield product_1.default.findOne({ type, item });
        if (!product) {
            throw new Error(`Product ${item} not found`);
        }
        const currentSoldStock = Number(product.soldStock);
        const quantityToAdd = Number(quantity);
        product.soldStock = currentSoldStock + quantityToAdd;
        product.updatedBy = updatedBy;
        product.specification = specification;
        product.partyName = partyName; // Update product with party name if available
        product.location = location; // Update product with location if available
        product.stockHistory.push({
            user: updatedBy,
            speci: specification,
            quantity,
            action: 'sold',
            date: new Date(),
            partyName: partyName || '-', // Use a default if partyName is not provided
            location: location || '-' // Use a default if location is not provided
        });
        yield product.save();
        updatedProducts.push(product);
    }
    return updatedProducts;
});
const createProductHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Destructure values from the request body
    const { type, item, currentStock, soldStock, updatedBy, specification, partyName, location } = req.body;
    // Ensure both partyName and location are provided since they are marked as required
    if (!partyName || !location) {
        return res.status(400).json({ message: 'Party name and location are required.' });
    }
    // Create a new product instance
    const newProduct = new product_1.default({
        type,
        item,
        currentStock,
        soldStock,
        updatedBy,
        specification,
    });
    try {
        // Save the new product to the database
        const savedProduct = yield newProduct.save();
        res.status(201).json({
            message: `Product ${savedProduct.item} added successfully.`,
            product: savedProduct,
        });
    }
    catch (error) {
        // Handle errors during save operation
        res.status(400).json({ message: error.message });
    }
});
exports.createProductHandler = createProductHandler;
const addStockHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { updates } = req.body;
    try {
        const updatedProducts = yield addStock(updates);
        res.status(201).json({
            message: `Product added successfully.`,
            product: updatedProducts,
        });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
exports.addStockHandler = addStockHandler;
const addSoldStockHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { updates } = req.body;
    try {
        const updatedProducts = yield addSoldStock(updates);
        res.status(201).json({
            message: `Product added successfully.`,
            product: updatedProducts,
        });
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
});
exports.addSoldStockHandler = addSoldStockHandler;
const getBatteriesStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const batteries = yield product_1.default.find({ type: 'Battery' });
        const response = batteries.map(battery => ({
            id: battery._id,
            type: battery.type,
            item: battery.item,
            currentStock: battery.currentStock,
            soldStock: battery.soldStock,
            remainingStock: battery.currentStock - battery.soldStock,
            lastUpdated: battery.lastUpdated,
            updatedBy: battery.updatedBy,
            partyName: battery.partyName || '-', // Include partyName
            location: battery.location || '-', // Include location
        }));
        res.json({
            message: "Battery retrieved successfully.",
            products: response,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getBatteriesStock = getBatteriesStock;
const getChargersStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const chargers = yield product_1.default.find({ type: 'Charger' });
        const response = chargers.map(charger => ({
            id: charger._id,
            type: charger.type,
            item: charger.item,
            currentStock: charger.currentStock,
            soldStock: charger.soldStock,
            remainingStock: charger.currentStock - charger.soldStock,
            lastUpdated: charger.lastUpdated,
            updatedBy: charger.updatedBy,
            partyName: charger.partyName || '-', // Include partyName
            location: charger.location || '-', // Include location
        }));
        res.json({
            message: "Charger retrieved successfully.",
            products: response,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getChargersStock = getChargersStock;
const getVehiclesStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const vehicles = yield product_1.default.find({ type: 'Vehicle' });
        const response = vehicles.map(vehicle => ({
            id: vehicle._id,
            type: vehicle.type,
            item: vehicle.item,
            currentStock: vehicle.currentStock,
            soldStock: vehicle.soldStock,
            remainingStock: vehicle.currentStock - vehicle.soldStock,
            lastUpdated: vehicle.lastUpdated,
            updatedBy: vehicle.updatedBy,
            partyName: vehicle.partyName || '-', // Include partyName
            location: vehicle.location || '-', // Include location
        }));
        res.json({
            message: "Vehicle stock retrieved successfully.",
            products: response,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getVehiclesStock = getVehiclesStock;
const getStockHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { type } = req.params;
    if (!['battery', 'charger', 'vehicle'].includes(type.toLowerCase())) {
        return res.status(400).json({ message: "Invalid type. Use 'battery', 'charger', or 'vehicle'." });
    }
    const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
    const products = yield product_1.default.find({ type: formattedType });
    if (products.length === 0) {
        return res.status(404).json({ message: `No ${type}s found.` });
    }
    const history = products.flatMap(product => product.stockHistory.map(entry => ({
        item: product.item,
        action: entry.action,
        quantity: entry.quantity,
        user: entry.user,
        date: entry.date,
        specification: entry.speci || '-',
        partyName: entry.partyName || '-', // include partyName
        location: entry.location || '-', // include location
    })));
    res.json({
        message: `${formattedType} stock history retrieved successfully.`,
        history,
    });
});
exports.getStockHistory = getStockHistory;
