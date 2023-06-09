const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const { getDay, format } = require('date-fns');
const config = require('config');
const getCurrentWeekNumber = require('current-week-number');

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

const getWeekNumber = (lowerCaseText) => {
  const matches = lowerCaseText.match(/kw (\d{1,2})/);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  return null;
};

const findDayNumber = (lowerCaseText, index) => {
  const weekday = weekdays.slice().reverse().find((weekday) => {
    const weekdayWithSpaces = weekday.toLowerCase().split('').join(' ');
    const weekdayIndex = lowerCaseText.indexOf(weekdayWithSpaces);
    return weekdayIndex > -1 && index > weekdayIndex;
  });
  return weekdays.indexOf(weekday) + 1;
}

const run = async () => {
  if (!config.slackWebhookUrl) {
    throw new Error('Slack Webhook URL not configured!');
  }
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
      return await fetch(config.slackWebhookUrl, {
        method: 'POST',
        body: JSON.stringify({ message: 'Schnitzel day! https://noon-food.com/karte/wochenspeisekarte.pdf' }),
        headers: {'Content-Type': 'application/json'}
      });
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
      return await fetch(config.slackWebhookUrl, {
        method: 'POST',
        body: JSON.stringify({ message: 'Cordon Bleu today! https://noon-food.com/karte/wochenspeisekarte.pdf' }),
        headers: {'Content-Type': 'application/json'}
      });
    } else {
      console.log('No Cordon Bleu today :-(')
    }
  }
}

module.exports = run;
