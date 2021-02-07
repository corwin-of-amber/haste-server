const path = require('path');

module.exports = {
    mode: "production",
    entry: "./src/application.js",
    output: {
        "path": path.resolve(__dirname, 'static'),
        "filename": "application.min.js"
    }
};
