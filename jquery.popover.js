/**
 * @license GNU General Public License v2 http://www.gnu.org/licenses/gpl-2.0
 * @author BlueMöhre <bluemoehre@gmx.de>
 * @copyright 2014 BlueMöhre
 * @link http://www.github.com/bluemoehre
 */

// use window and document as local variables due to performance improvement
(function ($, win, doc) {

    'use strict';

    /**
     * Plugin name and data-attr name (change for solving conflicts)
     * @type {string}
     */
    var PLUGIN_NAME = 'popover';

    /**
     * Default options for this plugin
     * @type {{Object}}
     */
    var defOpts = {
        // selector, jQuery-Collection or HTML
        tpl: '<div class="popover"><h6>__headline__</h6><p>__text__</p></div>',

        // can contain a URL (e.g. "https://...", "/path/file", "./relative/path")
        // can contain a object to fill the template
        // can contain HTML (will overwrite template)
        content: {
            headline: 'This is a popover',
            text: 'This is the default text for a popover.'
        },

        prepareContent: function(content){ return content },
        escapeContent: true,
        selectHideTrigger: 'a', // selector for elements which will hide the popover
        showOnClick: true,
        showOnHover: true,
        showOnHoverDelay: 1000,
        animSpeed: 100
    };

    /**
     * Extended document
     * @type {jQuery}
     */
    var $doc = $(doc);


    /**
     * Returns a HTML escaped string
     * @param {string} text
     * @returns {string}
     */
    function htmlEncode(text) {
        return document.createElement('div').appendChild(document.createTextNode(text)).parentNode.innerHTML;
    }

    /**
     * Returns the given string where all placeholders have been replaced with the given data
     * @param {string} html
     * @param {Object} data
     * @param {Boolean} [escape=true]
     * @returns {string}
     */
    function replacePlaceholders(html, data, escape) {
        var placeholder;
        var replacement;
        escape = escape !== false;
        for (placeholder in data) {
            if (data.hasOwnProperty(placeholder)) {
                placeholder = placeholder.replace(/([.*+?\^=!:${}()|\[\]\/\\])/g, "\\$1"); // escape regex special characters
                replacement = escape ? htmlEncode(data[placeholder]) : data[placeholder];
                html = html.replace(new RegExp('__' + placeholder + '__', 'g'), replacement);
            }
        }
        return html;
    }

    /**
     * Returns a template's HTML as string.
     * Templates can be specified by jQuery-Selector or HTML-String.
     * HTML-Strings will passed through, script templates will be unwrapped, normal elements will be converted to string.
     * @param {string} tpl
     * @returns {string}
     */
    function getTemplate(tpl) {
        var $tpl = $(tpl);
        return $tpl[0][$tpl.is('script[type="text/template"]') ? 'innerHTML' : 'outerHTML'];
    }



    /**
     * Plugin constructor
     * @param {HTMLElement} el
     * @constructor
     */
    function Plugin(el, args) {

        /**
         * The element which was passed to the plugin
         * @type {jQuery}
         */
        var $el = $(el);

        /**
         * The plugin settings for this instance
         * @type {Object}
         */
        var opts = {};

        /**
         * Self-reference
         * @type {Plugin}
         */
        var self = this;

        /**
         * @type {jQuery}
         */
        var $popover;

        /**
         * Was popover shown by a click?
         * @type {boolean}
         */
        var explicitlyShown = false;

        /**
         * Mouse hover delay timer
         * @type {number}
         */
        var showTimeout = 0;

        /**
         * Mouse left delay timer
         * @type {number}
         */
        var hideTimeout = 0;

        /**
         * Contains a running request
         * @type {?jqXHR}
         */
        var runningRequest = null;


        /**
         * Init function for setting up this instance
         * The settings are cascaded in the following order:
         *  - the plugin defaults
         *  - the given options via jQuery-call
         *  - the element options via attribute
         *  (latest takes precedence)
         *
         * @param {Object} initOpts
         */
        function init(initOpts) {
            var attrOptStr = $el.attr('data-' + PLUGIN_NAME);
            var attrOpts = attrOptStr ? $.parseJSON(attrOptStr) : {};
            opts = $.extend({}, defOpts, initOpts, attrOpts);

            // add event handlers
            if (opts.showOnClick){
                $el.on('click.' + PLUGIN_NAME, function (evt) {
                    evt.preventDefault();
                    if ($popover && $popover.parent().length) {
                        self.hide();
                    } else {
                        show();
                        explicitlyShown = true;
                    }
                });
            }
            if (opts.showOnHover){
                $el.on('mouseenter.' + PLUGIN_NAME, function () {
                    clearTimeout(hideTimeout);
                    showTimeout = setTimeout(function () {
                        show();
                    }, opts.showOnHoverDelay);
                }).on('mouseleave.' + PLUGIN_NAME, function () {
                    clearTimeout(showTimeout);
                    if (!explicitlyShown) {
                        hideTimeout = setTimeout(function () {
                            self.hide();
                        }, opts.showOnHoverDelay);
                    }
                });
            }
        }

        /**
         * Loads content from remote source
         * @param url
         */
        function loadRemoteContent(url, callback){
            if (typeof callback != 'function'){
                callback = $.noop;
            }

            // prevent double execution
            if (runningRequest){
                runningRequest.abort();
            }

            runningRequest = $.ajax({
                type: 'GET',
                url: url,
                dataType: 'html json',
                success: function(data){
                    callback(data);
                },
                complete: function(){
                    runningRequest = null;
                }
            });

            return runningRequest;
        }

        /**
         * Builds the popover and adds it to the DOM
         * @param content
         */
        function buildPopover(content){
            $popover = $(typeof content == 'object' ? replacePlaceholders(getTemplate(opts.tpl), content, opts.escapeContent) : content);
            $popover.on('click.'+ PLUGIN_NAME, function(evt){
                if (!$(evt.target).is(opts.selectHideTrigger)){
                    debug.log('click event stopped at', evt.target);
                    evt.stopPropagation();
                }
            });

            if (opts.showOnHover){
                $popover
                    .on('mouseenter.'+ PLUGIN_NAME, function(evt){
                        debug.log(evt.type +' triggered', evt);
                        clearTimeout(hideTimeout);
                    })
                    .on('mouseleave.'+ PLUGIN_NAME, function(evt){
                        debug.log(evt.type +' triggered', evt);
                        if (!explicitlyShown){
                            clearTimeout(showTimeout);
                            hideTimeout = setTimeout(function(){
                                self.hide();
                            }, opts.showOnHoverDelay);
                        }
                    });
            }
        }

        /**
         * Show the popover
         */
        function showPopover(){
            // if popover is available and is not attached to the dom
            $popover.stop(true);
            if (!$popover.parent().length){
                $popover
                    .css({
                        opacity: 0,
                        position: 'absolute',
                        left: $el.position().left + parseInt($el.css('margin-left')) + $el.outerWidth()/2 +'px',
                        top: $el.position().top + + parseInt($el.css('margin-top')) + $el.outerHeight() +'px'
                    })
                    .insertAfter($el)
                    .css('margin-left', $popover.outerWidth()/2*-1 +'px');
                $doc.trigger('DOMContentAdded', $popover); // let other plugins bind their handlers
            }
            $popover.fadeTo(opts.animSpeed, 1);

            // delay event binding on document to prevent the first click event triggering close immediately
            setTimeout(function(){
                $doc.one('click.'+ PLUGIN_NAME, self.hide);
            }, 0);
        }

        /**
         * Create popover, fetch contents and show it
         */
        function show(){
            // if no popover is present built new one
            // (this should be only done on request and NOT on init)
            if (!$popover){
                // test if content is URL and fetch contents from remote
                if (typeof opts.content == 'string' && opts.content.match(/^(https?:\/)?\.?\//)){
                    loadRemoteContent(opts.content , function(content){
                        buildPopover(opts.prepareContent(content));
                        showPopover();
                    });
                } else {
                    buildPopover(opts.prepareContent(opts.content));
                    showPopover();
                }

            } else {
                showPopover();
            }
        }


        /**
         * Public wrapper for internal show()
         */
        this.show = function(){
            debug.log('show() called');
            clearTimeout(showTimeout);
            explicitlyShown = true;
            show();
        };

        /**
         * Hide popover
         */
        this.hide = function () {
            clearTimeout(hideTimeout);
            explicitlyShown = false;
            $doc.off('click.'+ PLUGIN_NAME, self.hide); // unbind only for this instance
            if ($popover) {
                $popover.stop(true).fadeTo(opts.animSpeed, 0, function () {
                    $popover.detach();
                });
            }
        }

        /**
         * Remove this plugin off the element
         * This function should revert all changes which have been made by this plugin
         */
        this.destroy = function () {
            $doc.off('.' + PLUGIN_NAME, self.hide); // unbind only for this instance
            $el.find('*').addBack().off('.' + PLUGIN_NAME);
            $el.removeData(PLUGIN_NAME);
            $el = null;
        };


        init(args);
    }



    // Register plugin on jQuery
    $.fn[PLUGIN_NAME] = function () {
        var args = arguments || [];
        var val;

        this.each(function () {

            // Prevent multiple instances for same element
            var instance = $.data(this, PLUGIN_NAME);
            if (!instance) {
                instance = new Plugin(this, typeof args[0] === 'object' ? args[0] : {});
                $.data(this, PLUGIN_NAME, instance);
            }

            // Call public function
            // If it returns something, break the loop and return the value
            if (typeof args[0] === 'string') {
                if (typeof instance[args[0]] === 'function') {
                    val = instance[args[0]](args[1]);
                } else {
                    $.error('Method "' + args[0] + '" does not exist for ' + PLUGIN_NAME + ' plugin');
                }
            }

            return val === undefined;
        });

        return val === undefined ? this : val;
    };


    // Auto pilot
    $(doc).on('ready ajaxStop DOMContentAdded', function (evt, nodes) {
        (nodes ? $(nodes) : $doc).find('[data-' + PLUGIN_NAME + ']').addBack('[data-' + PLUGIN_NAME + ']')[PLUGIN_NAME]();
    });


})(jQuery, window, document);
