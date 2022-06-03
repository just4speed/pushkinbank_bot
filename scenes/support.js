const { Composer, Scenes } = require("telegraf");
const { Keyboard } = require("telegram-keyboard");

const default_keyboard = Keyboard.make([
    ['Вывести деньги', 'Информация'],
    ["Реферальная система"],
    ['Поддержка', 'FAQ'], 
]);

const startStep = new Composer();
startStep.on("text", ctx => {
    ctx.wizard.state.data = {};
    ctx.replyWithHTML("✍️ Задайте интересующий ваш вопрос\nЕсли же вы столкнулись с какой-то проблемой или хотите связаться напрямую с администратором, в подробностях опишите свою ситуацию");
    return ctx.wizard.next();
});

const confirmStep = new Composer();
confirmStep.on("text", ctx => {
    const questionText = ctx.message.text;
    ctx.wizard.state.data.text = questionText;
    const keyboard = Keyboard.make([
        ["Да, создать обращение"],
        ["Отмена"] 
    ]);
    ctx.replyWithHTML("Текст вашего обращения:\n\n<i>" + questionText + "</i>\n\nУверены ?", keyboard.reply());
    return ctx.wizard.next();
});

const finalStep = new Composer();
finalStep.on("text", ctx => {
    const userDecision = ctx.message.text;
    const userId = ctx.message.from.id;
    if(userDecision === "Да, создать обращение"){
        ctx.telegram.sendMessage(1257409280, "НОВОЕ ОБРАЩЕНИЕ\n" + userId + "\n\n" + ctx.wizard.state.data.text);
        ctx.reply("Ваше обращение отправлено команде", default_keyboard.reply());
        return ctx.scene.leave();
    } else if(userDecision === "Отмена"){
        ctx.reply("Вы отменили создание обращения", default_keyboard.reply());
        return ctx.scene.leave();
    } else {
        //
    }
});

const supportScene = new Scenes.WizardScene("supportWizard", startStep, confirmStep, finalStep);

module.exports = supportScene;