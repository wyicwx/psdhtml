const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const PSD = require('psd');
const Tree = require('./lib/tree.js');

module.exports = function (psdFile, options = {}) {
    let psd = PSD.fromFile(psdFile);
    let fileName = path.basename(psdFile, '.psd');

    options.imagedir = options.imagedir || 'images';
    options.scssdir = options.scssdir || 'scss';
    options.workdir = options.workdir || process.cwd();

    options.imagedir = path.resolve(options.workdir, options.imagedir);
    options.scssdir = path.resolve(options.workdir, options.scssdir);

    mkdirp.sync(options.imagedir);
    mkdirp.sync(options.scssdir);

    psd.parse();

    let tree = new Tree(psd);

    return tree.exportImage(options.imagedir).then(() => {
        let html = tree.exportHtml();
        let scss = tree.exportScss('/$rem');

        html = [`<layout src="../../commons/layouts/rem.html" data-css="./css/index.css">`, html, '</layout>'];
        scss = [`@import 'global.scss';`, '$line_height: 1.5;', '', scss];

        fs.writeFileSync(path.join(options.scssdir, fileName + '.scss'), scss.join('\r'));
        fs.writeFileSync(path.join(options.workdir, fileName + '.html'), html.join('\r'));
    });
};
