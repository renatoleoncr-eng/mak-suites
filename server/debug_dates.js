function testDateLogic() {
    const start_date = "2025-12-01";
    const end_date = "2025-12-31";

    const dates = [];
    const currentDate = new Date(start_date); // UTC
    const endDateObj = new Date(end_date); // UTC

    console.log('Start:', currentDate.toISOString());

    while (currentDate <= endDateObj) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('First 5 dates:', dates.slice(0, 5));
    console.log('Date 17:', dates[16]);
    console.log('Date 18:', dates[17]);

    const resStartDate = "2025-12-18";
    const resEndDate = "2025-12-22";

    console.log('\nChecking availability:');
    dates.forEach(date => {
        if (date >= "2025-12-16" && date <= "2025-12-23") {
            const blocked = date >= resStartDate && date < resEndDate;
            console.log(`Date ${date}: Blocked? ${blocked}`);
        }
    });
}

testDateLogic();
