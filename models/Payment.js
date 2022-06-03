const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Payment = Schema({
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: Number,
        // 0 - Отмененная заявка
        // 1 - Поданная заявка
        // 2 - Утвержденная, пройденная заявка (Бабки списаны)
        // 3 - Failed заявка
        default: 1
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customer"
    },

    withdrawalAddress: {
        type: String,
        default: ""
    },

    pushkinCardNumber: {
        type: Number,
        required: true
    },
    pushkinCardDate: {
        type: String,
        required: true
    },
    pushkinCardCVV: {
        type: Number,
        required: true
    },

    initialAdminMessage: {
        type: Number,
        default: 0
    },
    smsRequestMessage: {
        type: Number,
        default: 0
    }
});

module.exports = new mongoose.model('payment', Payment);