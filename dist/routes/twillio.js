"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const twillio_1 = require("../controller/twillio");
const router = (0, express_1.Router)();
router.post('/submit-request', twillio_1.submitRequest);
router.post('/whatsapp-webhook', twillio_1.whatsappWebhook);
exports.default = router;
