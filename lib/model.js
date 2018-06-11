const path = require('path');
function __typeof__ (objClass) {
    if (objClass && objClass.constructor) {
        var strFun = objClass.constructor.toString();
        var className = strFun.substr(0, strFun.indexOf('('));
        className = className.replace('function', '');
        return className.replace(/(^\s*)|(\s*$)/ig, '');  
    }
    return typeof(objClass);
}

const typeCount = {};

class DOMModel {
    constructor (node, parent, index) {
        this.node = node;
        this.parent = parent;
        // 子元素列表
        this.childrens = [];
        this.index = index;
        // psd节点数据
        this.layer = node.export();
        // dom属性
        this.dom = {
            class: '',
            tag: 'div',
            style: {
                display: null,
                position: null,
                top: null,
                left: null,
                width: null,
                height: null,
                overflow: null,
                'margin-top': null,
                background: null,
                'background-size': null
            },
            text: null,
            background: null
        };
        // 子元素根据类型分类
        this.typeChildrens = {
            Group: [],
            Layer: [],
            Text: []
        };
        // 判断类型
        this.type = __typeof__(node); // Group|Layer|Text
        if (this.type === 'Layer' && this.node.get('typeTool')) {
            this.type = 'Text';
        }
        // 子元素根据类型分类
        this.parent.typeChildrens[this.type].push(this);
        this.typeIndex = this.parent.typeChildrens[this.type].length - 1;
        // 元素名称
        this.name = this.type.substr(0, 1) + this.typeIndex;
        if (!this.parent.isRoot) {
            this.name = this.parent.name + '-' + this.name;
        }
        // 嵌套层级数
        this.nesting = this.getNestingTimes();
        // 自定义规则
        this.rule = this.getRule();
        // group的几个特性
        let groupRules = this.rule.group;
        let isFlex, isAbsolute, isFlow;
        if (groupRules) {
            this.isFlex = groupRules.indexOf('flex') !== -1;
            this.isAbsolute = groupRules.indexOf('absolute') !== -1;
            this.isFlow = groupRules.indexOf('flow') !== -1;
        }
        // 是否是第一个非absolute的元素
        this.isFirstNoAbsoluteGroup = false;
    }

    getRule () {
        let rules = {};

        // 解析name自定义规则
        let customRule = this.layer.name.split('|');
        customRule.forEach((rule) => {
            let type = rule.split('.')[0];
            let value = rule.split('.')[1];

            if (!value) {
                return;
            }

            if (!rules[type]) {
                rules[type] = [];
            }

            rules[type].push(value);
        });

        return rules;
    }

    parse () {
        // 解析样式
        let {parent} = this;
        let {left, top, height, width} = this.layer;
        // 默认每个元素都有高度
        this.dom.style.height = height;

        // 父元素的group规则
        let parentGroupRules;
        if (this.parent && this.parent.rule) {
            parentGroupRules = this.parent.rule.group;
        }
        // 父元素的布局类型
        let parentIsFlex, parentIsFlow;
        if (this.parent) {
            parentIsFlex = this.parent.isFlex;
            parentIsFlow = this.parent.isFlow;
        }

        if (this.type === 'Group') {
            // 解析rule
            let {parent, rule, isFlex, isAbsolute, isFlow} = this;
            let {group: groupRules, 'class': classRules} = rule;

            // 最外层overflow: hidden;
            if (this.parent && this.parent.isRoot) {
                this.dom.style.overflow = 'hidden';
            }

            // 确定position
            let position = isAbsolute ? 'absolute' : 'relative';
            this.dom.style.position = position;

            // 确定display
            if (isFlex) {
                this.dom.style.display = 'flex';
                this.dom.style['justify-content'] = 'center';
                this.dom.style['align-items'] = 'center';
            }

            // 确定left, top
            if (isAbsolute) {
                if (!this.parent.isRoot) {
                    this.dom.style.top = this.layer.top - this.parent.layer.top;
                    this.dom.style.left = this.layer.left - this.parent.layer.left;
                }
            }

            // 确定width
            let domWidth = null;

            // 如果absolute, 确定宽度
            if (isAbsolute || isFlow || parentIsFlow) {
                domWidth = width;
            } else if (parentIsFlex) { // 如果父节点flex, 确定宽度，但本身若存在class flex_1,则去掉width
                domWidth = width;
                if (classRules && classRules.indexOf('flex_1') !== -1) {
                    domWidth = null;
                }
            }
            // 最高优先级，直接指定要有宽度
            if (groupRules && groupRules.indexOf('width') !== -1) {
                domWidth = width;
            }
            this.dom.style.width = domWidth;

            // 确定margin-top
            let marginTop = null;
            if (isAbsolute || parentIsFlex) {
                marginTop = null;
            } else {
                let offsetTop = 0;
                if (this.typeIndex === 0) {
                    if (!this.parent.isRoot) {
                        offsetTop = this.layer.top - this.parent.layer.top;
                        this.isFirstNoAbsoluteGroup = true;
                    }
                } else {
                    // let preNode = this.parent.typeChildrens[this.type][this.typeIndex - 1];
                    // offsetTop = this.layer.top - preNode.layer.bottom;
                    // 找到前一个不是absolute的元素
                    this.isFirstNoAbsoluteGroup = false;
                    let nodeWithNoAbsolute;
                    let children = this.parent.typeChildrens[this.type];
                    for (var i = this.typeIndex - 1; i >= 0; i--) {
                        if (!children[i].isAbsolute) {
                            nodeWithNoAbsolute = children[i];
                            break;
                        }
                    }
                    if (nodeWithNoAbsolute) {
                        offsetTop = this.layer.top - nodeWithNoAbsolute.layer.bottom;
                    } else { // 如果没找到，证明它是非absolute的第一个
                        if (!this.parent.isRoot) {
                            offsetTop = this.layer.top - this.parent.layer.top;
                            this.isFirstNoAbsoluteGroup = true;
                        }
                    }
                }
                marginTop = offsetTop;
            }
            this.dom.style['margin-top'] = marginTop;

            // 确定margin-left, margin-right
            if (isFlow || parentIsFlow) {
                this.dom.style['margin-left'] = 'auto';
                this.dom.style['margin-right'] = 'auto';
            }

            if (this.node.hasChildren()) {
                let firstNoAbsoluteGroup;
                this.node.children().reverse().forEach((node, index) => {
                    let model = new DOMModel(node, this, index);
                    let grule = model.rule.group;
                    if (grule && grule.indexOf('bg') !== -1) {
                        this.dom.style.background = `url(../images/${model.name}.png) center top no-repeat;`;
                        this.dom.style['background-size'] = 'contain';
                        this.dom.background = model;
                    } else if (model.layer.visible) {
                        model.parse();
                        this.childrens.push(model);
                    }
                    if (model.isFirstNoAbsoluteGroup) {
                        firstNoAbsoluteGroup = model;
                    }
                });
                // 父元素和第一个子元素外边距合并的调整
                if (firstNoAbsoluteGroup) {
                    this.dom.style['box-sizing'] = 'border-box';
                    this.dom.style['padding-top'] = firstNoAbsoluteGroup.dom.style['margin-top'];
                    firstNoAbsoluteGroup.dom.style['margin-top'] = null;
                }
            }

        } else {
            this.dom.style.width = this.layer.width;
            this.dom.style.position = 'absolute';

            this.dom.style.top = this.layer.top;
            this.dom.style.left = this.layer.left;

            if (!this.parent.isRoot && this.parent.layer) {
                this.dom.style.left = this.layer.left - this.parent.layer.left;
            }
            if (!this.parent.isRoot) {
                this.dom.style.top -= this.parent.layer.top;
            }

            if (this.type === 'Text') {
                let typeTool = this.node.get('typeTool').export();

                this.dom.style['font-size'] = typeTool.font.sizes[0];
                this.dom.style.color = `rgba(${typeTool.font.colors[0].join(', ')})`;
                this.dom.style['text-align'] = typeTool.alignment || null;
                this.dom.style['line-height'] = 1.5;

                if (typeTool.font.name.toLocaleLowerCase().indexOf('bold') !== -1) {
                    this.dom.style['font-weight'] = 'bold';
                }
                this.dom.tag = 'span';
                this.dom.style.height = null;
                this.dom.text = typeTool.value.replace('\r', '<br>');
            } else { // layer
                this.dom.style.background = `url(../images/${this.name}.png) no-repeat;`;
                this.dom.style['background-size'] = 'contain';
            }
        }

        for (let type in this.rule) {
            let value = this.rule[type];

            switch (type) {
            case 'class':
                this.dom.class = value.join(' ');
                break;
            case 'tag':
                this.dom.tag = value[0];
                break;
            case 'tx':
                if (value.indexOf('title') !== -1) {
                    if (this.type === 'Text') {
                        this.dom.style['line-height'] = 1;
                        this.dom.style['white-space'] = 'nowrap';
                        this.dom.style.width = null;
                    }
                }
            }
        }
    }

    getNestingTimes () {
        let parent = this.parent;
        let nesting = 1;

        while (parent) {
            if (parent.isRoot) {
                break;
            }
            nesting++;
            parent = parent.parent;
        }

        return nesting;
    }

    exportHtml () {
        if (!this.layer.visible) {
            return '';
        }

        let html = [];
        let fillSpace = (new Array(this.nesting + 1)).join('    ');
        let tag = this.dom.tag;
        let className = this.dom.class ? [this.dom.class, this.name].join(' ') : this.name;

        if (this.type === 'Group') {
            html.push(`${fillSpace}<${tag} class="${className}">`);
            this.childrens.forEach((model) => {
                html.push(model.exportHtml());
            });
            html.push(`${fillSpace}</${tag}>`);
        } else if (this.type === 'Text') {
            html.push(`${fillSpace}<${tag} class="${className}">${this.dom.text}</${tag}>`);
        } else {
            html.push(`${fillSpace}<${tag} class="${className}"></${tag}>`);
        }

        return html.join('\r');
    }

    exportScss (unit) {
        let scss = [];
        let fillSpace = (new Array(this.nesting)).join('    ');
        let profileSpace = (new Array(this.nesting + 1)).join('    ');

        scss.push(`${fillSpace}.${this.name} {`);

        for (let key in this.dom.style) {
            let value = this.dom.style[key];

            if (value === null) {
                continue;
            }

            switch (key) {
            case 'top':
            case 'left':
            case 'width':
            case 'height':
            case 'margin-top':
            case 'padding-top':
            case 'font-size':
                value += unit;
                break;
            }

            scss.push(`${profileSpace}${key}: ${value};`);
        }

        if (this.type === 'Group') {
            this.childrens.forEach((model) => {
                scss.push(model.exportScss(unit));
            });

        }

        scss.push(`${fillSpace}}`);

        return scss.join('\r');
    }

    exportImage (directory) {
        if (this.type === 'Group') {
            let promises = this.childrens.map((model) => {
                return model.exportImage(directory);
            });

            if (this.dom.background) {
                this.dom.background.exportImage(directory);
            }

            return Promise.all(promises);
        } else if (this.type === 'Layer') {
            return this.node.saveAsPng(path.join(directory, this.name + '.png'));
        }
    }
}

module.exports = DOMModel;