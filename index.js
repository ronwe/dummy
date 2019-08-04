const carlo = require('carlo');
const fs = require('fs');
const path = require('path');
const { exec, spawn} = require('child_process');
const { rpc } = require('carlo/rpc');

const UserDataDir = path.resolve(__dirname, '../.dummydata');
class Backend {
    constructor() {
        this.PIDS = [];
    }
    connect(frontend) {
        this.frontend = frontend;
    }
    async runKill({padId}) {
        if (this.PIDS[padId]) {
            this.PIDS[padId].kill(); 
        }
    }
    async runCode({padId, type, input}){
        let proc;
        let tmpFile;
        if (!input) {
            return;
        }
        if ('js' === type) {
            tmpFile = path.resolve(__dirname, 'tmp_' + (+new Date));
            fs.writeFileSync(tmpFile, input);
            proc = spawn('node', [tmpFile]);
        } else {
            proc = exec(input);
        }
        this.PIDS[padId] = proc;
        proc.stdout.on('data', (data) => {
            data = data.toString();
            console.log(`stdout: ${data}`);
            this.frontend.log({padId, data});
        });
        proc.stderr.on('data', (data) => {
            data = data.toString();
            console.log(`stderr: ${data}`);
            this.frontend.error({padId, data});
        });

        proc.on('close', (code) => {
            if (tmpFile) {
                console.log('tmpFile', tmpFile)
                fs.unlinkSync(tmpFile);
            }
            delete this.PIDS[padId];
            console.log(`child process exited with code ${code}`);
            this.frontend.close({padId});
        })
    }
}
(async () => {
    let appWin = await carlo.launch({userDataDir: UserDataDir});
    appWin.serveFolder(__dirname);
    appWin.setIcon('./favicon.ico');
    await appWin.load('index.html', rpc.handle(new Backend));
})();
