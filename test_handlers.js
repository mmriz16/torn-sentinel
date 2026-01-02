/**
 * Test each handler and output results to JSON
 */
import { getAllUsers } from './src/services/userStorage.js';
import fs from 'fs';

// Import all handlers
import { jobHandler } from './src/services/autorun/handlers/jobHandler.js';
import { workHandler } from './src/services/autorun/handlers/workHandler.js';
import { workPerformanceHandler } from './src/services/autorun/handlers/workPerformanceHandler.js';
import { companyHandler } from './src/services/autorun/handlers/companyHandler.js';

async function testHandlers() {
    const results = {};

    const mockClient = {
        channels: {
            fetch: async () => null
        }
    };

    // Test each handler
    const handlers = [
        { name: 'jobHandler', fn: jobHandler },
        { name: 'workHandler', fn: workHandler },
        { name: 'workPerformanceHandler', fn: workPerformanceHandler },
        { name: 'companyHandler', fn: companyHandler },
    ];

    for (const h of handlers) {
        console.log(`Testing ${h.name}...`);
        try {
            const result = await h.fn(mockClient);
            if (result === null) {
                results[h.name] = { status: 'NULL', error: 'Handler returned null' };
            } else {
                results[h.name] = {
                    status: 'SUCCESS',
                    fields: result.data?.fields?.map(f => ({ name: f.name, value: f.value })) || []
                };
            }
        } catch (error) {
            results[h.name] = {
                status: 'ERROR',
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join('\n')
            };
        }
    }

    fs.writeFileSync('./data/handler_results.json', JSON.stringify(results, null, 2));
    console.log('Results saved to data/handler_results.json');
}

testHandlers();
