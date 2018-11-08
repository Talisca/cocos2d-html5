cc.PixelLabel = cc.BatchedLabel.extend({
    ctor:function (strText, _charMapFile, lineWidth, fontSize) {
        cc.BatchedLabel.prototype.ctor.call(this, strText,_charMapFile,lineWidth,fontSize);

        this.baseFontSize = this._fontDict.commonHeight;
        this.setFontSize(this.baseFontSize);
    },
    getBaseFontSize: function()
    {
        return this.baseFontSize;
    },
    setFontSize: function(size)
    {
        if(size%this.baseFontSize === 0)
        {
            cc.BatchedLabel.prototype.setFontSize.call(this,size);
        }
        else
        {
            console.warn("scaling pixellabel fonts to non-multiple of their base font size is not supported to preserve pixel-perfectness. choose a different \
             font size based on getBaseFontSize() or pick a font that as the font size you want to use.");
        }
    },
    setScale: function(scale)
    {
        console.warn("scaling PixelLabel is disabled to preserve pixel-perfectness.")
    }
});