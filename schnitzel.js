const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const { getDay, format } = require('date-fns');
const getCurrentWeekNumber = require('current-week-number');
const { WebClient } = require('@slack/web-api');
const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");


const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

const getWeekNumber = (lowerCaseText) => {
  const matches = lowerCaseText.match(/kw\s*(\d{1,2})/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  throw new Error("Unable to determine week number from PDF");
};

const findDayNumber = (lowerCaseText, index) => {
  const weekday = weekdays.slice().reverse().find((weekday) => {
    const weekdayWithSpaces = weekday.toLowerCase().split('').join(' ');
    const weekdayIndex = lowerCaseText.indexOf(weekdayWithSpaces);
    return weekdayIndex > -1 && index > weekdayIndex;
  });
  return weekdays.indexOf(weekday) + 1;
}

const getCustomers = async () => {
  const client = new DynamoDBClient();
  const command = new ScanCommand({TableName: 'schnitzel-bot-slack-tokens'});
  const result = await client.send(command);
  return result["Items"].map(item => ({client_id: item.client_id.S, token: item.token.S}))
}

const sendMessage = async (message) => {
  const customers = await getCustomers();
  console.log(`${customers.length} customers loaded`)

  const results = await Promise.allSettled(customers.map(async (customer) => {
    try {
      console.log(`Sending message to ${customer.client_id}...`);
      const slackClient = new WebClient(customer.token);
      const listChannelsResponse = await slackClient.conversations.list({limit: 1000});
      if (!listChannelsResponse.ok) {
        throw new Error("Slack list conversations call resulted in unsuccessful result")
      }
      const channels = listChannelsResponse.channels.filter(channel => channel.is_member);
      console.log(`${channels.length} channel(s) loaded for ${customer.client_id}`)
      await Promise.all(channels.map(async (channel) => {
        await slackClient.chat.postMessage({
          text: message,
          channel: channel.id
        })
      }))
      console.log(`Message sent to ${customer.client_id}`);
    } catch (error) {
      console.log(`Message sending failed for ${customer.client_id}`, error)
      throw error
    }
  }))

  const failedResults = results.filter(result => result.status === "rejected");
  if (failedResults.length > 0) {
    throw new Error("Some of message sending failed")
  }
}

const run = async () => {
  console.log('Fetching Wochenkarte...');
  const pdfResponse = await fetch('https://noon-food.com/karte/wochenspeisekarte.pdf');
  console.log('Wochenkarte loaded')
  const pdfBuffer = await pdfResponse.arrayBuffer();
  console.log('Parsing PDF...');
  const { text } = await pdf(pdfBuffer);
  console.log('PDF parsed');
  const lowerCaseText = text.toLowerCase();
  const currentWeekNumber = getCurrentWeekNumber();
  const pdfWeekNumber = getWeekNumber(lowerCaseText);
  if (currentWeekNumber !== pdfWeekNumber) {
    console.log(`Wochenkarte (${pdfWeekNumber}) is for a different week (${currentWeekNumber})`);
    return;
  }

  // Schnitzel
  const schnitzelIndex = lowerCaseText.indexOf('schnitzel');
  if (schnitzelIndex > -1) {
    console.log('Found Schnitzel');
    const schnitzelDay = findDayNumber(lowerCaseText, schnitzelIndex);
    const day = getDay(new Date());
    if (day === schnitzelDay) {
      console.log('Sending Slack message...');
      return await sendMessage('Schnitzel day! https://noon-food.com/karte/wochenspeisekarte.pdf')
    } else {
      console.log('Not Schnitzel day :-(')
    }
  }

  // Cordon Bleu
  const cordonIndex = lowerCaseText.indexOf('cordon');
  if (cordonIndex > -1 && lowerCaseText.includes("bleu")) {
    console.log('Found Cordon Bleu');
    const cordonDay = findDayNumber(lowerCaseText, cordonIndex);
    const day = getDay(new Date());
    if (day === cordonDay) {
      console.log('Sending Slack message...');
      return await sendMessage('Cordon Bleu today! https://noon-food.com/karte/wochenspeisekarte.pdf')
    } else {
      console.log('No Cordon Bleu today :-(')
    }
  }
}

module.exports = run;
