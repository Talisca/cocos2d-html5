//label class based on usual bitmap fonts that supports batched rendering
cc.BatchedLabel = cc.Node.extend(/** @lends cc.LabelAtlas# */{
    //property String is Getter and Setter
    // string to render
    _string: null,


    /**
     * <p>
     *  Constructor function, override it to extend the construction behavior, remember to call "this._super()" in the extended "ctor" function. <br />
     *  Create a label atlas. <br />
     *  It accepts two groups of parameters: <br/>
     * a) string, fntFile <br/>
     * b) label, textureFilename, width, height, startChar <br/>
     * </p>
     * @param {String} strText
     * @param {String} charMapFile  charMapFile or fntFile
     * @param {Number} [lineWidth=Number.MAX_VALUE], maximum line width of a single line of text
     */
    ctor: function (strText, charMapFile, lineWidth) {
        cc.Node.prototype.ctor.call(this);
        this._lineWidth = lineWidth || Number.MAX_VALUE;
        this._breakWithoutSpace = false;

        var dict = cc.loader.getRes(charMapFile);

        if (!dict) {
            return false;
        }

        var textureFilename = dict.atlasName;
        this._charMap = dict.fontDefDictionary;
        this._lineHeight = dict.commonHeight;

        var texture = null;
        texture = this._atlasTexture = cc.textureCache.addImage(textureFilename);

        var locLoaded = texture.isLoaded();
        this._textureLoaded = locLoaded;
        if (!locLoaded) {
            texture.addEventListener("load", function (sender) {
                this.dispatchEvent("load");
            }, this);
        }
    },

    setBreakWithoutSpace: function (value) {
        this._breakWithoutSpace = value;
    },

    _createRenderCmd: function () {
        return new cc.LabelAtlas.WebGLRenderCmd(this);
    },


    initWithString: function (strText, charMapFile, itemWidth, itemHeight, startCharMap) {
        var label = strText + "", textureFilename, width, height, startChar;
        if (itemWidth === undefined) {
            var dict = cc.loader.getRes(charMapFile);
            var locScaleFactor = cc.contentScaleFactor();

            if (!dict) {
                return false;
            }

            if (parseInt(dict["version"], 10) === 1) {
                textureFilename = cc.path.changeBasename(charMapFile, dict["textureFilename"]);

                width = parseInt(dict["itemWidth"], 10) / locScaleFactor;
                height = parseInt(dict["itemHeight"], 10) / locScaleFactor;
                startChar = String.fromCharCode(parseInt(dict["firstChar"], 10));
            }
            else {
                textureFilename = dict.atlasName;
                this._charMap = dict.fontDefDictionary;
                this._lineHeight = dict.commonHeight;
                width = 20;
                height = 20;
                startChar = "a";
                this._charDictMode = true;
            }

        } else {
            textureFilename = charMapFile;
            width = itemWidth || 0;
            height = itemHeight || 0;
            startChar = startCharMap || " ";
        }

        var texture = null;
        if (textureFilename instanceof cc.Texture2D)
            texture = textureFilename;
        else
            texture = cc.textureCache.addImage(textureFilename);
        var locLoaded = texture.isLoaded();
        this._textureLoaded = locLoaded;
        if (!locLoaded) {
            this._string = label;
            texture.addEventListener("load", function (sender) {
                this.initWithTexture(texture, width, height, label.length);
                this.string = this._string;
                this.setColor(this._renderCmd._displayedColor);
                this.dispatchEvent("load");
            }, this);
        }
        if (this.initWithTexture(texture, width, height, label.length)) {
            this._mapStartChar = startChar;
            this.string = label;
            return true;
        }
        return false;
    },

    /**
     * return the text of this label
     * @return {String}
     */
    getString: function () {
        return this._string;
    },

    setString: function (label) {
        if (this._string === label)
            return;
        label = String(label);
        this._string = label;
        this.setContentSize();
    }
});
