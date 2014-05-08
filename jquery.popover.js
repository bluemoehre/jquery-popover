/**
 * @license GNU General Public License v2 http://www.gnu.org/licenses/gpl-2.0
 * @author BlueMöhre <bluemoehre@gmx.de>
 * @copyright 2014 BlueMöhre
 * @link http://www.github.com/bluemoehre
 */

// use window and document as local variables due to performance improvement
(function($, win, doc) {

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
        tpl: '<div class="popover"><h6>__headline__</h6><p>__text__</p></div>', // selector, jQuery-Collection or HTML
        content: {
            // - data to fill the template
            // TODO ... jQuery-Collection, HTML or URL (in these cases the template will be obsolete)
            headline: 'This is a popover',
            text: 'This is the default text for a popover.'
        },
        escapeContent: true,
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
     * Plugin constructor
     * @param {HTMLElement} el
     * @constructor
     */
    function Plugin(el)
    {
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
        var wasClicked = false;

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
         * Returns an escaped string
         * Fastest version!
         * @see http://jsperf.com/htmlencoderegex/25
         * @param {string} text
         * @returns {string}
         */
        function htmlEncode(text){
            return document.createElement('div').appendChild(document.createTextNode(text)).parentNode.innerHTML;
        }

        /**
         * Returns the current string where all placeholders have been replaced with the given data
         * @param {string} html
         * @param {object} data
         * @returns {string}
         */
        function replacePlaceholders(html, data){
            $.each(data, function(placeholder, value){
                html = html.replace('__'+ placeholder +'__', opts.escapeContent ? htmlEncode(value) : value);
            });
            return html;
        }


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
        this.init = function(initOpts){
            var attrOptStr = $el.attr('data-'+ PLUGIN_NAME);
            var attrOpts = attrOptStr ? $.parseJSON(attrOptStr) : {};
            opts = $.extend({}, defOpts, initOpts, attrOpts);

            // add event handlers
            $el.on('click.'+ PLUGIN_NAME, function(evt){
                evt.preventDefault();
                wasClicked = true;
                self.show();
            })
                .on('mouseenter.'+ PLUGIN_NAME, function(){
                    clearTimeout(hideTimeout);
                    showTimeout = setTimeout(function(){
                        self.show();
                    }, opts.showOnHoverDelay);
                })
                .on('mouseleave.'+ PLUGIN_NAME, function(){
                    clearTimeout(showTimeout);
                    if (!wasClicked){
                        hideTimeout = setTimeout(function(){
                            self.hide();
                        }, opts.showOnHoverDelay);
                    }
                })

        };

        /**
         * Remove this plugin off the element
         * This function should revert all changes which have been made by this plugin
         */
        this.destroy = function(){
            $doc.off('.' + PLUGIN_NAME);
            $el.find('*').addBack().off('.' + PLUGIN_NAME);
        };

        /**
         * Show popover
         */
        this.show = function(){
            clearTimeout(showTimeout);

            // if no popover is present built new one
            if (!$popover){

                var $tpl = $(opts.tpl);
                if ($tpl.is('script[type="text/template"]')){
                    $popover = $(replacePlaceholders($tpl[0].innerHTML, opts.content));
                } else {
                    $popover = $(replacePlaceholders($tpl[0].outerHTML, opts.content));
                }

                $popover
                    .on('click.'+ PLUGIN_NAME, function(evt){
                        evt.stopPropagation();
                    })
                    .on('mouseenter.'+ PLUGIN_NAME, function(){
                        clearTimeout(hideTimeout);
                    })
                    .on('mouseleave.'+ PLUGIN_NAME, function(){
                        if (!wasClicked){
                            clearTimeout(showTimeout);
                            hideTimeout = setTimeout(function(){
                                self.hide();
                            }, opts.showOnHoverDelay);
                        }
                    })

            }

            // if popover is available and is not attached to the dom
            if (!$popover.parent().length){
                $popover
                    .css({
                        opacity: 0,
                        position: 'absolute',
                        left: $el.position().left + $el.outerWidth()/2 +'px',
                        top: $el.position().top + $el.outerHeight() + parseInt($el.css('margin-top')) +'px'
                    })
                    .insertAfter($el)
                    .css('margin-left', $popover.outerWidth()/2*-1 +'px')
                    .stop(true)
                    .fadeTo(opts.animSpeed, 1);

                // delay event binding, so the click event for showing does not trigger close immediately
                setTimeout(function(){
                    $doc.one('click.'+ PLUGIN_NAME, function(){
                        self.hide();
                    })
                }, 0);
            }
        };

        /**
         * Hide flyout
         */
        this.hide = function(){
            clearTimeout(hideTimeout);
            wasClicked = false;
            if ($popover){
                $popover.stop(true).fadeTo(opts.animSpeed, 0, function(){
                    $popover.detach();
                });
            }
        }
    }



    // Register plugin on jQuery
    $.fn[PLUGIN_NAME] = function(){
        var args = arguments;

        return this.each(function(){

            // Prevent multiple instances for same element
            var instance = $.data(this, PLUGIN_NAME);

            // Init plugin
            if (!instance){
                instance = new Plugin(this);
                $.data(this, PLUGIN_NAME, instance);
                // init with settings object - care about init
                instance.init(typeof args[0] == 'object' ? args[0] : typeof args[1] == 'object' ? args[1] : {});
            }
            // Call public function
            if (instance[args[0]] && args[0] != 'init'){
                instance[args[0]](args[1]);
            }
            // Re-Init plugin on element
            else if (instance && typeof args[0] == 'object'){
                instance.destroy();
                instance.init(args[0]);
            }
            // Call public function
            if (args[0] != 'init' && instance[args[0]]){
                instance[args[0]](args[1]);
            }
            // Method unknown
            else if (typeof args[0] == 'string'){
                $.error("Method '" + args[0] + "' doesn't exist for " + PLUGIN_NAME + " plugin");
            }

        });

    };


    // Auto pilot
    $(doc).on('ready ajaxStop DOMContentAdded', function(evt, nodes){
        $(nodes || document).find('[data-' + PLUGIN_NAME + ']').addBack('[data-' + PLUGIN_NAME + ']')[PLUGIN_NAME]();
    });


})(jQuery, window, document);
