const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const { getDay, format } = require('date-fns');
const config = require('config');

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

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
  const schnitzelIndex = lowerCaseText.indexOf('schnitzel');
  if (schnitzelIndex > -1) {
    console.log('Found Schnitzel');
    const schnitzelWeekday = weekdays.slice().reverse().find((weekday) => {
      const weekdayWithSpaces = weekday.toLowerCase().split('').join(' ');
      const weekdayIndex = lowerCaseText.indexOf(weekdayWithSpaces);
      return weekdayIndex > -1 && schnitzelIndex > weekdayIndex;
    });
    const day = getDay(new Date());
    if (day === (weekdays.indexOf(schnitzelWeekday) + 1)) {
      console.log('Sending Slack message...');
      await fetch(config.slackWebhookUrl, {
        method: 'POST',
        body: JSON.stringify({ message: 'Schnitzel day! https://noon-food.com/karte/wochenspeisekarte.pdf' }),
        headers: {'Content-Type': 'application/json'}
      });
    } else {
      console.log('Not Schnitzel day :-(')
    }
  }
}

module.exports = run;