'use strict';

var Alexa = require("alexa-sdk");
var AWS = require("aws-sdk");
var https = require("https");
var util = require("util");

var APP_ID = undefined;  // TODO replace with your app ID (OPTIONAL).

var LOCATION_NEWS = "1lgdwXd2iCPIWMf6fppnZn9TtHz8odYnj91JqDL6r9dg/values/NEWS!A3:Z1000";
var LOCATION_ANSWERS = "1lgdwXd2iCPIWMf6fppnZn9TtHz8odYnj91JqDL6r9dg/values/ANSWERS!A3:Z1000";
var LOCATION_QUESTIONS = "1lgdwXd2iCPIWMf6fppnZn9TtHz8odYnj91JqDL6r9dg/values/QUESTIONS!!A3:Z1000";
var LOCATION_HELP = "1lgdwXd2iCPIWMf6fppnZn9TtHz8odYnj91JqDL6r9dg/values/HELP!A2:Z1000";

var imagePrefix = "";

var states = {
    START: "_START"
};

var handlers = {
     "LaunchRequest": function() {
        this.handler.state = states.START;
        this.emitWithState("LaunchRequest");
     },
    "SessionEndedRequest": function() {
        this.handler.state = states.START;
        this.emitWithState("SessionEndedRequest");
     },
    "Unhandled": function() {
        this.handler.state = states.START;
        this.emitWithState(this.event.request.intent.name);
    }
};

var startHandlers = Alexa.CreateStateHandler(states.START,{
    "LaunchRequest": function () {
        var speechText = getRandomWelcomeMessage() + getRandomWelcomeQuestion();
        this.response.speak(speechText).listen(getRandomWelcomeQuestion());
        this.emit(":responseReady");
    },
    "AnswerIntent": function () {
        if (isSlotFound.call(this, "answer"))
        {
            var slotValue = getSlotValue.call(this,"answer");
            sendResponse.call(this, slotValue);
        }
        else
        {
            console.log("DID NOT FIND A MATCHING SYNONYM");
            var speechText = getRandomConfusionMessage.call(this) + getRandomQuestion();
            this.response.speak(speechText).listen(getRandomQuestion());
            this.emit(":responseReady");           
        }
    },
    "MeetingAudioIntent": function () {
        this.response.audioPlayer("play", "REPLACE_ALL", "https://internal.genoatwp.com/webdocuments/public/audio/Trustee/2018/2018-01-22%20Trustee%20Zoning%20Meeting.mp3", "token", null, 0);
        console.log("THIS.RESPONSE FOR AUDIO MEETING FILE = " + JSON.stringify(this.response));
        this.emit(":responseReady");
    },
    "NewsIntent": function () {
        console.log("FULL REQUEST = " + JSON.stringify(this.event));
        httpsGet(LOCATION_NEWS, (result) => {
            console.log("RESULT = " + JSON.stringify(result));
            var date = new Date();
            var speechText = "Here is your Genoa Township news for " + date.toDateString() + ". " + getVoiceNews(result) + getRandomQuestion();
            this.response.speak(speechText).listen(getRandomQuestion());
            //this.response.speak("I don't have any news yet.  Is there something else I can help you with?").listen(getRandomQuestion());
            this.response.cardRenderer("GENOA TOWNSHIP NEWS FOR " + date.toDateString(), getCardNews(result), {smallImageUrl: "https://s3.amazonaws.com/genoatownship/genoatownship.jpg", largeImageUrl: "https://s3.amazonaws.com/genoatownship/genoatownship.jpg"});
            //if (supportsDisplay.call(this)) this.response.renderTemplate(buildListDisplayTemplateForNews(news));
            this.emit(":responseReady");
        });
    },
    "GetRandomItemIntent": function () {
        sendResponse.call(this, null);
    },
    "AMAZON.CancelIntent": function () {
        var speechText = getRandomGoodbyeMessage();
        this.response.speak(speechText);
        this.emit(":responseReady");
    },
    "AMAZON.HelpIntent": function () {
        //sendResponse.call(this, "HELP");
        httpsGet(LOCATION_HELP, (data) => {
            var speechText = getRandomHelpMessage.call(this, data) + getRandomQuestion();
            this.response.speak(speechText).listen(getRandomQuestion());
            this.emit(":responseReady");
        });
    },
    "AMAZON.NoIntent": function () {
        var speechText = getRandomGoodbyeMessage();
        this.response.speak(speechText);
        this.emit(":responseReady");
    },
    "AMAZON.RepeatIntent": function() {
        console.log("REPEAT REQUESTED.");
        sendResponse.call(this, this.attributes["answer"]);
    },
    "AMAZON.StopIntent": function () {
        var speechText = getRandomGoodbyeMessage();
        this.response.speak(speechText);
        this.emit(":responseReady");
    },
    "AMAZON.YesIntent": function () {
        var speechText = getRandomQuestion();
        this.response.speak(speechText).listen(getRandomQuestion());
        this.emit(":responseReady");
    },
    "SessionEndedRequest": function() {
        console.log("SESSION ENDED REQUEST!");
        console.log("FULL REQUEST = " + JSON.stringify(this.event));
        this.response.speak("Goodbye!");
        this.emit(":responseReady");
     },
    "Unhandled": function() {
        console.log("UNHANDLED EVENT!! " + JSON.stringify(this.event));
        var speechText = getRandomConfusionMessage.call(this) + getRandomQuestion();
        sendSMS(slotValue, (result) => {
            console.log("RETURNED FROM SMS.");
            this.response.speak(speechText).listen(getRandomQuestion());
            this.emit(":responseReady");
        });
    }
});



function sendResponse(item)
{
    httpsGet(LOCATION_ANSWERS, (data) => {
        var itemCount = 1;
        if ((item != null)&&(item != "HELP"))
        {
            if ((this.event.request.intent != undefined)&&(this.event.request.intent.slots != undefined)) itemCount = this.event.request.intent.slots.answer.resolutions.resolutionsPerAuthority[0].values.length;
            else itemCount = 1;
        }
        
        if (itemCount === 1)
        {
            var answer = getAnswerData(data, item);
            console.log(JSON.stringify(answer));
            this.attributes["answer"] = answer[0];
            var speechText = getRandomConfirmation(answer) + getVoiceSpeechResponse(answer) + " <break time='.5s'/>" + getRandomCardCallout() + getRandomQuestion();
            this.response.speak(speechText).listen(getRandomQuestion());
            //if (supportsDisplay.call(this)) this.response.renderTemplate(buildBodyDisplayTemplate(answer));        
            this.response.cardRenderer(getCardTitle(answer), getCardText(answer), {smallImageUrl: getSmallCardImage(answer), largeImageUrl: getLargeCardImage(answer)});
            console.log("THIS.RESPONSE = " + JSON.stringify(this.response));
            this.emit(":responseReady");
        }
        else if (itemCount > 1)
        {
            var speechText = getRandomConfirmation(this.event.request.intent.slots.answer.value) + ", and I found " + itemCount + " potential answers for you.  Which one would you like to know about?"
            var response = "";
            var itemList = [];
            for (var i = 0; i<itemCount;i++)
            {
                var slotData = data.values.find((slot) => { return slot[0].toUpperCase() === this.event.request.intent.slots.answer.resolutions.resolutionsPerAuthority[0].values[i].value.name.toUpperCase() });
                if (slotData != undefined)
                {
                    itemList.push(slotData);
                    speechText += " " + slotData[3];
                    response += "\n" + slotData[3]
                    if (i <= (itemCount-2)) speechText += ", ";
                    if (i===(itemCount-2)) speechText += "or ";
                }

            }
            speechText += "?";
            this.response.speak(speechText).listen("Which one would you like to know about?");
            //if (supportsDisplay.call(this)) this.response.renderTemplate(buildListDisplayTemplate.call(this, itemList));
            //this.response.cardRenderer("MULTIPLE ANSWERS FOR " + this.event.request.intent.slots.answer.value.toUpperCase(), response);
            this.emit(":responseReady");
        }
    });
}

var isRandomAnswer = false;

function getAnswerData(data, value)
{
    if ((value === null)||(value === undefined))
    {
        isRandomAnswer = true;
        var random = getRandom(0, data.values.length-1);
        console.log("GETTING A RANDOM ANSWER = [" + random + "][" + data.values[random][0] + "]");
        return data.values[random];
    }
    else
    {
        var answerData = data.values.find((answer) => {
            console.log("DO THESE MATCH? [" + answer[0] + "] [" + value + "]")
            return answer[0].toUpperCase().trim() === value.toUpperCase().trim();
        });
        return answerData;
    }
}

function getCardTitle(answer)
{
    if ((answer[3] === undefined)||(answer[3] === "")) return answer[0];
    else return answer[3];
}

function getCardText(answer)
{
    return answer[4];
}

function getVoiceSpeechResponse(answer)
{
    return answer[2];
}

function getSmallCardImage(answer)
{
    if ((answer[5] === undefined)||(answer[5] === "")) return "https://s3.amazonaws.com/genoatownship/genoatownship.jpg";
    else return answer[5];
}

function getLargeCardImage(answer)
{
    if ((answer[6] === undefined)||(answer[6] === "")) return "https://s3.amazonaws.com/genoatownship/genoatownship.jpg";
    else return answer[6];
}

/*
OBJECT REFERENCE
0 - ANSWER NAME
1 - PRNOUNCIATION
2 - SPEECH DATA
3 - CARD TITLE
4- CARD TEXT 
5 - SMALL CARD IMAGE
6 - LARGE CARD IMAGE
*/



function getRandomTip(tips)
{
    var random = getRandom(0, tips.length-1);
    return tips[random];
}

function getVoiceNews(list)
{
    var voiceNews = "";
    for (var i = 0; i < list.values.length; i++)
    {
        voiceNews = voiceNews + list.values[i][0] + "<break time='.5s'/>" + list.values[i][1] + "<break time='1s'/>";
    }
    return voiceNews;
}

function getCardNews(list)
{
    var cardNews = "";
    for (var i = 0; i < list.values.length; i++)
    {
        cardNews = cardNews + list.values[i][0].toUpperCase() + "\n" + list.values[i][1] + "\n \n";
    }
    return cardNews;
}

function getRandomConfirmation(answer)
{
    console.log("GETTING RANDOM CONFIRMATION");
    console.log("ANSWER[0] = " + answer[0]);
    console.log("ANSWER[1] = " + answer[1]);
    console.log("ANSWER[3] = " + answer[3]);
    if (typeof answer != 'string')
    {
        if (answer[1] !== "")
        {
            answer = answer[1];
        }
        else answer = answer[0];
    }

    var callouts = ["Ah, you're asking me about " + answer,
                    "I think you're looking for information about " + answer,
                    "You want to know more about " + answer,
                    "You asked me about " + answer];
    var randomCallouts = ["You asked me for a random topic about Genoa Township, and I picked " + answer,
                          "The random answer I picked for you is " + answer,
                          "I picked " + answer + " for you.",
                          "After digging through my options, I decided to choose " + answer + " for you."];
    var response = "";
    var random = 0;

    if (isRandomAnswer) {
        random = getRandom(0, randomCallouts.length-1);
        response = randomCallouts[random];
    }
    else {
        random = getRandom(0, callouts.length-1);
        response = callouts[random];
    }
    
    isRandomAnswer = false;
    return response + ". <break time='.5s'/>";
}

function getRandomQuestion()
{
    console.log("GETTING RANDOM QUESTION");
    var callouts = ["What do you want to know about?",
                    "What else can I help you with?",
                    "Which other topic can I assist with?"];
    var random = getRandom(0, callouts.length-1);
    return " " + callouts[random];
}

function getRandomCardCallout()
{
    var callouts = ["I have written a card to your Alexa app with more information.",
                    "More information has been written to your Alexa app.",
                    "I've saved this information to your Alexa app.",
                    "You can find this information saved in your Alexa app."];
    var random = getRandom(0, callouts.length-1);
    return " " + callouts[random];
}

function getRandomUnusedIntentMessage(intent)
{
    var messages = ["This skill doesn't currently use the " + intent + " intent, but we are constantly adding functionality and demos.",
                    "I don't use the " + intent + " intent yet.",
                    "This skill supports the " + intent + " intent, but we're not using it yet.",
                    "We wanted to support all of the intents, but the " + intent + " intent just doesn't do anything yet."];
    var random = getRandom(0, messages.length-1);
    return " " + messages[random];
}

function getRandomSpeechcon(name)
{
    var speechcons = ["bam", "bazinga", "bravo", "hip hip hooray", "hurray", "katchow", "oh snap", "wahoo", "way to go", "well done", "woo hoo", "yay", "yippee", "zing"];
    var random = getRandom(0, speechcons.length-1);
    return "<say-as interpret-as='interjection'>" + speechcons[random] + "</say-as><break time='500ms'/>";
}

function getRandomWelcomeMessage()
{
    var messages = ["Welcome to Genoa Township.",
                   "This is Genoa Township.",
                   "Hello!",
                   "Welcome!"];
    var random = getRandom(0, messages.length-1);
    return messages[random];
}

function getRandomWelcomeQuestion()
{
    var questions = ["What can I tell you about Genoa Township?",
                     "What can I help you with?",
                     "What topic can I assist with?",
                     "What would you like to know about?"];
    var random = getRandom(0, questions.length-1);
    return " " + questions[random];
}

function getRandomHelpMessage(data)
{
    var random = getRandom(0, data.length-1);
    console.log("RANDOM HELP MESSAGE = " + JSON.stringify(random));
    return data[random][1];
}



function getRandomGoodbyeMessage()
{
    var messages = ["Goodbye!",
                   "Buh bye!",
                   "See you on the flip side!",
                   "Have fun storming the castle!",
                   "See you later alligator!",
                   "Catch you next time!",
                   "After while, crocodile!"];
    var random = getRandom(0, messages.length-1);
    return messages[random];
}

function getRandomConfusionMessage()
{
    var spokenWords = "I heard you say " + this.event.request.intent.slots.answer.value + " ";
    var messages = ["I don't seem to know how to answer that one yet, but I'll work on it.",
                   "Hmmm.  I can't seem to figure that one out.",
                   "There's a chance I misunderstood you, but I don't know how to answer your question.",
                   "I'm sorry. I don't know how to help you with that.",
                   "I don't have an answer for you today, but I'll add it to my list of things I should learn soon!"];
    var random = getRandom(0, messages.length-1);
    return spokenWords + "<break time='500ms'/>" + messages[random];
}

function getRandom(min, max)
{
    return Math.floor(Math.random() * (max-min+1)+min);
}

function isSlotFound(slotName)
{
    var failFlag = true;
    if (this.event.request.intent === undefined) failFlag = false;
    else if (this.event.request.intent.slots === undefined) failFlag = false;
    else if (this.event.request.intent.slots[slotName] === undefined) failFlag = false;
    else if (this.event.request.intent.slots[slotName].value === undefined) failFlag = false;
    else if (this.event.request.intent.slots[slotName].resolutions === undefined) failFlag = false;
    else if (this.event.request.intent.slots[slotName].resolutions.resolutionsPerAuthority[0].status.code != "ER_SUCCESS_MATCH") failFlag = false;
    
    if (!failFlag && (this.event.request.token != undefined)) failFlag = true;

    return failFlag;
}

function supportsDisplay()
{
    var hasDisplay = this.event.context && this.event.context.System && this.event.context.System.device && this.event.context.System.device.supportedInterfaces && this.event.context.System.device.supportedInterfaces.Display;
  
    return hasDisplay;
  }

function getSlotValue(slotName)
{
    var slotvalue = "";
    //IF THERE IS A SLOT VALUE, GET IT.
    if (this.event.request.intent != undefined) return this.event.request.intent.slots[slotName].resolutions.resolutionsPerAuthority[0].values[0].value.name;
    //IF THERE'S NOT A SLOT VALUE, THEN WE ARE LOOKING FOR A TOKEN.  GET IT.
    else return this.event.request.token.replace("-", " ");
}

function sendSMS(message, callback)
{
    console.log("SENDING SMS.");
    const params = { PhoneNumber: "+16143275066", Message: message};
    SNS.publish(params, function(err,data)
    {
        if (err) { console.log(err.stack);}
        else
        {
            console.log("TEXT MESSAGE SENT! [" + message + "]");
        }
        callback(true);
    });
    
}

function httpsGet(location, callback) {
    var options = {
        host: "sheets.googleapis.com",
        port: 443,
        path: "/v4/spreadsheets/" + location + "?key=AIzaSyBjUvLoGzpnqBKxG3TF3wVCaMFRluvMbpU",
        method: 'GET',
    };

    console.log("PATH = https://" + options.host + options.path);

    var req = https.request(options, res => {
        res.setEncoding('utf8');
        var returnData = "";

        res.on('data', chunk => {
            returnData = returnData + chunk;
        });

        res.on('end', () => {
            var data = JSON.parse(returnData);
            console.log("DATA = " + JSON.stringify(data));
            callback(data);
        });

    });
    req.end();

}

exports.handler = function (event, context) {
    console.log("EVENT " + JSON.stringify(event));
    console.log("CONTEXT " + JSON.stringify(context));
    const alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(handlers, startHandlers);
    alexa.execute();
};
