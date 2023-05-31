const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const { getDay, format } = require('date-fns');

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

const run = async () => {
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
      await fetch('https://hooks.slack.com/workflows/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', {
        method: 'POST',
        body: JSON.stringify({ message: 'Schnitzel day! https://noon-food.com/karte/wochenspeisekarte.pdf' }),
        headers: {'Content-Type': 'application/json'}
      });
    } else {
      console.log('Not Schnitzel day :-(')
    }
  }
}

exports.handler = async () => {
  await run();
}
