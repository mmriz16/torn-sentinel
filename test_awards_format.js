// Quick test untuk formatting Awards
const entry = {
    category: 'Awards',
    log: 5140,
    title: 'Title change',
    timestamp: 1767166635,
    data: {
        title: 'Scavenger'
    }
};

// Simulate formatLogText logic
if (entry.log === 5140 && entry.data?.title) {
    const formatted = `Berganti title menjadi "${entry.data.title}"`;
    console.log('✅ BEFORE:', entry.title);
    console.log('✅ AFTER:', formatted);
    console.log('\nPreview in code block:');
    console.log('```');
    console.log(formatted);
    console.log('```');
} else {
    console.log('❌ No match');
}
