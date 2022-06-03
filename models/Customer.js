const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Customer = Schema({
    telegram_id: {
        type: String,
        unique: true,
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    referrals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "customer",
        default: []
    }],
});

module.exports = new mongoose.model('customer', Customer);