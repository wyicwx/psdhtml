const fs = require('fs');
const Model = require('./model.js');

class Tree {
    constructor (psd) {
        this.nodes = psd.tree().children();
        this.isRoot = true;
        this.childrens = [];
        this.name = 'root';
        this.typeChildrens = {
            Group: [],
            Layer: [],
            Text: []
        };

        this.parse();
    }

    parse (nodes) {
        this.nodes.reverse().forEach((node, index) => {
            let model = new Model(node, this, index);

            if (model.layer.visible) {
                model.parse();

                this.childrens.push(model);
            }
        });
    }

    exportScss (unit) {
        let scss = [];

        this.childrens.forEach((model) => {
            scss.push(model.exportScss(unit));
        });

        return scss.join('\r');
    }

    exportHtml () {
        let html = [];

        this.childrens.forEach((model) => {
            html.push(model.exportHtml());
        });

        return html.join('\r');
    }

    exportImage (path) {
        let promises = this.childrens.map((model) => {
            return model.exportImage(path);
        });

        return Promise.all(promises);
    }
}

module.exports = Tree;