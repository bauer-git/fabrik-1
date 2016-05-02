/**
 * List
 *
 * @copyright: Copyright (C) 2005-2013, fabrikar.com - All rights reserved.
 * @license:   GNU/GPL http://www.gnu.org/copyleft/gpl.html
 */

define(['jquery', 'fab/fabrik', 'fab/list-toggle', 'fab/list-grouped-toggler', 'fab/list-keys',
'fab/list-actions', 'fab/mootools-ext'],
    function (jQuery, Fabrik, FbListToggle, FbGroupedToggler, FbListKeys, FbListActions) {
        var FbList = new Class({

            Implements: [Options, Events],

            actionManager: null,

            options: {
                'admin'              : false,
                'filterMethod'       : 'onchange',
                'ajax'               : false,
                'ajax_links'         : false,
                'links'              : {'edit': '', 'detail': '', 'add': ''},
                'form'               : 'listform_' + this.id,
                'hightLight'         : '#ccffff',
                'primaryKey'         : '',
                'headings'           : [],
                'labels'             : {},
                'Itemid'             : 0,
                'formid'             : 0,
                'canEdit'            : true,
                'canView'            : true,
                'page'               : 'index.php',
                'actionMethod'       : 'floating', // deprecated in 3.1
                'formels'            : [], // elements that only appear in the form
                'data'               : [], // [{col:val, col:val},...] (depreciated)
                'itemTemplate'       : '',
                'floatPos'           : 'left', // deprecated in 3.1
                'csvChoose'          : false,
                'csvOpts'            : {
                    excel       : false,
                    incfilters  : false,
                    inctabledata: false,
                    incraw      : false,
                    inccalcs    : false
                },
		'popup_width'        : 300,
		'popup_height'       : 300,
                'popup_offset_x'     : null,
                'popup_offset_y'     : null,
                'groupByOpts'        : {},
                'isGrouped'          : false,
                'listRef'            : '', // e.g. '1_com_fabrik_1'
                'fabrik_show_in_list': [],
                'singleOrdering'     : false,
                'tmpl'               : '',
                'groupedBy'          : '',
                'toggleCols'         : false
            },

            initialize: function (id, options) {
                this.id = id;
                this.setOptions(options);
                this.getForm();
                this.result = true; //used with plugins to determine if list actions should be performed
                this.plugins = [];
                this.list = document.id('list_' + this.options.listRef);
                if (this.options.j3 === false) {
                    this.actionManager = new FbListActions(this, {
                        'method'  : this.options.actionMethod,
                        'floatPos': this.options.floatPos
                    });
                }

                if (this.options.toggleCols) {
                    this.toggleCols = new FbListToggle(this.form);
                }

                this.groupToggle = new FbGroupedToggler(this.form, this.options.groupByOpts);
                new FbListKeys(this);
                if (this.list) {
                    if (this.list.get('tag') === 'table') {
                        this.tbody = this.list.getElement('tbody');
                    }
                    if (typeOf(this.tbody) === 'null') {
                        this.tbody = this.list;
                    }
                    // $$$ rob mootools 1.2 has bug where we cant set('html') on table
                    // means that there is an issue if table contains no data
                    if (window.ie) {
                        this.options.itemTemplate = this.list.getElement('.fabrik_row');
                    }
                }
                this.watchAll(false);
                Fabrik.addEvent('fabrik.form.submitted', function () {
                    this.updateRows();
                }.bind(this));

                /**
                 * once an ajax form has been submitted lets clear out any loose events and the form object itself
                 *
                 * Commenting out as this causes issues for cdd after ajax form post
                 * http://www.fabrikar.com/forums/index.php?threads/cdd-only-triggers-js-change-code-on-first-change.32793/
                 */
                /*Fabrik.addEvent('fabrik.form.ajax.submit.end', function (form) {
                 form.formElements.each(function (el) {
                 el.removeCustomEvents();
                 });
                 delete Fabrik.blocks['form_' + form.id];
                 });*/

                // Reload state only if reset filters is not on
                if (!this.options.resetFilters && ((window.history && history.pushState) && history.state && this.options.ajax)) {
                    this._updateRows(history.state);
                }

                Fabrik.fireEvent('fabrik.list.loaded', [this]);
            },

            setItemTemplate: function () {
                // $$$ rob mootools 1.2 has bug where we cant setHTML on table
                // means that there is an issue if table contains no data
                if (typeOf(this.options.itemTemplate) === 'string') {
                    var r = this.list.getElement('.fabrik_row');
                    if (window.ie && typeOf(r) !== 'null') {
                        this.options.itemTemplate = r;
                    }
                }
            },

            /**
             * Used for db join select states.
             */
            rowClicks: function () {
                this.list.addEvent('click:relay(.fabrik_row)', function (e, r) {
                    var d = Array.from(r.id.split('_')),
                        data = {};
                    data.rowid = d.getLast();
                    var json = {
                        'errors': {},
                        'data'  : data,
                        'rowid' : d.getLast(),
                        listid  : this.id
                    };
                    Fabrik.fireEvent('fabrik.list.row.selected', json);
                }.bind(this));
            },

            watchAll: function (ajaxUpdate) {
                ajaxUpdate = ajaxUpdate ? ajaxUpdate : false;
                this.watchNav();
                this.storeCurrentValue();
                if (!ajaxUpdate) {
                    this.watchRows();
                    this.watchFilters();
                }
                this.watchOrder();
                this.watchEmpty();
                if (!ajaxUpdate) {
                    this.watchGroupByMenu();
                    this.watchButtons();
                }
            },

            watchGroupByMenu: function () {
                if (this.options.ajax) {
                    this.form.addEvent('click:relay(*[data-groupBy])', function (e, target) {
                        this.options.groupedBy = target.get('data-groupBy');
                        if (e.rightClick) {
                            return;
                        }
                        e.preventDefault();
                        this.updateRows();
                    }.bind(this));
                }
            },
            watchButtons: function () {
                this.exportWindowOpts = {
                    modalId    : 'exportcsv',
                    type       : 'modal',
                    id         : 'exportcsv',
                    title      : 'Export CSV',
                    loadMethod : 'html',
                    minimizable: false,
                    height     : 300,					
                    content    : '',
                    modal      : true,
                    bootstrap  : this.options.j3
                };
				
		this.exportWindowOpts.width = parseInt(this.options.csvOpts.popupwidth,10)>0 ? this.options.csvOpts.popupwidth : 340;					
		this.exportWindowOpts.optswidth = parseInt(this.options.csvOpts.optswidth,10)>0 ? this.options.csvOpts.optswidth : 200;					

                if (this.options.view === 'csv') {
                    // For csv links e.g. index.php?option=com_fabrik&view=csv&listid=10
                    this.openCSVWindow();
                } else {
                    if (this.form.getElements('.csvExportButton')) {
                        this.form.getElements('.csvExportButton').each(function (b) {
                            if (b.hasClass('custom') === false) {
                                b.addEvent('click', function (e) {
                                    this.openCSVWindow();
                                    e.stop();
                                }.bind(this));
                            }
                        }.bind(this));
                    }
                }
            },
			
	    centerCSVWindow: function(start) {
		/* hide the 'Save to' until file name is known */
		var savingto = (start > 0) ? 'block' : 'none';
		jQuery('p.saveto').css('display',savingto);	
				
		/* allow modal to collapse height once form options are hidden
		 * so that only csvmsg div is shown
		 */
		if(start >= 0 || jQuery('div.itemContent').outerHeight()==0){
			/* If selectable options - hide and remove space in DOM by setting outerHeight to 0 */
			if(jQuery('div.modal-footer').length) {
				jQuery('div.itemContent').outerHeight(0);	
				jQuery('div.modal').css('height','auto');	
				jQuery('div.modal-footer').css('position','relative');	
			}else{
				jQuery('div.itemContent').css('overflow','initial');
			}	
		}else{
			/* reset the itemContent height to max */
			if(jQuery('div.modal-footer').length) {
				jQuery('div.opt__file-type div').css({'float':'left','width': (this.exportWindowOpts.optswidth-8)+'px','background-color':'bisque','margin':'0px','padding':'4px 8px','font-weight':'600'});						
				jQuery('div.itemContent').css('height','auto');
			}	
		}			
		jQuery('#csvmsg').css('text-align','center');
									
		/* re-center the modal vertically */
		var viewHeight = jQuery(window).outerHeight();					
		var headHeight = jQuery('div.modal-header').outerHeight(true);
	
		/* modHeight source depends on if there is a mod_footer (options were are shown) */
		if(jQuery('div.modal-footer').length) {
			var modHeight = jQuery('div.itemContent').outerHeight(true);
			var footHeight =  jQuery('div.modal-footer').outerHeight(true);
		}else{
			/* just hard-code the itemContent height to accomodate 
			 * the csvmsg div if no options and footer are used */
			var modHeight = 134;
			var footHeight = 0;
			jQuery( 'div.modal' ).css('height',(headHeight+modHeight)+'px');
		}
		
		var frameHeight = parseInt(headHeight+modHeight+footHeight);

		/* If modal height will be within 10px of max (viewport) height
		 * set height of scrolling content be to 80% of viewport height 
		 * (allowing for header and footer)
		 */
		if(frameHeight+10 > viewHeight){
			var fullHeight= parseInt(headHeight+(viewHeight*.8)+footHeight);
			jQuery( 'div.itemContent' ).outerHeight(parseInt(viewHeight*.8));				
			jQuery( 'div.modal' ).outerHeight(fullHeight);	
			var offtop = parseInt((viewHeight-fullHeight)/2);
			jQuery( 'div.modal' ).css('top',offtop+'px');	
		}else{
			var offtop = parseInt((viewHeight-frameHeight)/2);
			jQuery('div.modal').css('top',offtop+'px');
		}
	    },
	    
            openCSVWindow: function() {
                var self = this;
                this.exportWindowOpts.content = this.makeCSVExportForm();
                this.csvWindow = Fabrik.getWindow(this.exportWindowOpts);
				
		/* fix footer to bottom and align Export button */
		jQuery('div.modal-footer').css(
			{'position':'absolute',
			 'bottom':'0px',
			 'padding':'15px 0px',
			 'width':'inherit'
			});
		jQuery('.exportCSVButton').css('margin-right','15px');
			
		/* Prevent browser window from being scrolled */
		jQuery('body').css({'height':'100%','overflow':'hidden'});

		/* Allow browser window to be scrolled again when modal is released from DOM */
		jQuery('div.modal').on('remove', function () {
			jQuery('body').css({'height':'initial','overflow':'initial'});	
		});	

		/* adds draggable feature to modal popup */
		jQuery('div.modal').draggable({
			handle: '.modal-header'
		});
		jQuery('.modal-header').on('mouseover', function(){
			jQuery(this).css('cursor','move');
		});	

		/* recenter popup if window viewport gets resized */
		jQuery(window).on('resize', function(){
			self.centerCSVWindow();	 
		});				
				
		/* force every form option to new line */
		jQuery('div.modal').find('form div[class^=opt__]').css({'clear':'left','float':'left','white-space':'nowrap'});
				
		/* Allow wide option labels to wrap */
		jQuery('div.modal').find('form div[class^=opt__] div').css({'line-height':'1.1em','white-space':'initial'});

		/* vertically center the popup */
		self.centerCSVWindow();	   

                jQuery('.exportCSVButton').on('click', function (e) {
                    e.stopPropagation();
                    this.disabled = true;
					
		    /* immediately hide the Export button and form options */
		    jQuery(this).hide();	
		    jQuery(this).closest('div.modal').find('.contentWrapper').hide();	
	
                    var csvMsg = jQuery('#csvmsg');
                    if (csvMsg.length === 0) {
                        csvMsg = jQuery('<div />').attr({
                            'id': 'csvmsg'
                        }).insertBefore(jQuery(this));
                    }
		
                    csvMsg.html(Joomla.JText._('COM_FABRIK_LOADING') +
                        ' <p><span id="csvcount">0</span> / <span id="csvtotal"></span> ' +
                        Joomla.JText._('COM_FABRIK_RECORDS') + '</p><p class="saveto">' + Joomla.JText._('COM_FABRIK_SAVING_TO') +
                        ' <span id="csvfile"></span></p>');				
                    self.triggerCSVExport(0);
                });
            },

            makeCSVExportForm: function () {
                if (this.options.csvChoose) {
                    this.csvExportForm = this._csvExportForm();
                    return this.csvExportForm;
                } else {
                    return this._csvAutoStart();
                }
            },

            _csvAutoStart: function () {
                var c = jQuery('<div />').attr({
                    'id': 'csvmsg'
                }).html(Joomla.JText._('COM_FABRIK_LOADING') +
                    ' <br /><span id="csvcount">0</span> / <span id="csvtotal"></span> ' +
                    Joomla.JText._('COM_FABRIK_RECORDS') + '.<br/>' + Joomla.JText._('COM_FABRIK_SAVING_TO') +
                    '<span id="csvfile"></span>');
				
                this.csvopts = this.options.csvOpts;
                this.csvfields = this.options.csvFields;

                this.triggerCSVExport(-1);
                return c;
            },

  	    /* Used to create class names for every line in the form options.
	     * This will allow for more easilly adding custom css styling to
	     * hide options that you don't want the user to be able to change. 
	     */
	    makeSafeForCSS: function(name) {
		return name.replace(/[^a-z0-9]/g, function(s) {
			var c = s.charCodeAt(0);
			if (c == 32) return '-';
			if (c >= 65 && c <= 90) return s.toLowerCase();
			return ('000' + c.toString(16)).slice(-4);
		});
	    },			
			
            /**
             * Create a csv yes/no radio div.
             * @param {string} name
             * @param {boolean} yesValue
             * @param {string} yesLabel
             * @param {string} noLabel
             * @param {string} title
             * @returns {*}
             * @private
             */
            _csvYesNo: function (name, yesValue, yesLabel, noLabel, title) {
		var label = jQuery('<label />').css({'display':'inline-block','margin-left':'15px'});
                var yes = label.clone().append(
                    [jQuery('<input />').attr({
                        'type' : 'radio',
                        'name' : name,
                        'value': '1',
                        checked: yesValue
                        }),
                        jQuery('<span />').text(yesLabel)
                    ]),

                    no = label.clone().append(
                        [jQuery('<input />').attr({
                            'type' : 'radio',
                            'name' : name,
                            'value': '0',
                            checked: !yesValue
                        }),
                        jQuery('<span />').text(noLabel)
                    ]),
                    titleLabel = jQuery('<div>').css({
			'margin': '3px 0px 1px 8px',
                        'width': this.exportWindowOpts.optswidth + 'px',
                        'float': 'left'
                    }).text(title);
					
		var thisClass = 'opt__' + this.makeSafeForCSS(title);
		return jQuery('<div class="' + thisClass + '">').css({'border-bottom':'1px solid #dddddd'}).append([titleLabel, yes, no]);
            },

            /**
             * Build the export csv form
             * @returns {*}
             * @private
             */
            _csvExportForm: function () {
		var thisClass,thisText;
                var yes = Joomla.JText._('JYES'),
                    no = Joomla.JText._('JNO'),
                    self = this,
                    url = 'index.php?option=com_fabrik&view=list&listid=' +
                        this.id + '&format=csv&Itemid=' + this.options.Itemid,
			label = jQuery('<label />').css('clear', 'left');

                var c = jQuery('<form />').attr({
                    'action': url,
                    'method': 'post'
                }).append([
                    this._csvYesNo('excel', this.options.csvOpts.excel,
                        'Excel CSV', 'CSV', Joomla.JText._('COM_FABRIK_FILE_TYPE')),
                    this._csvYesNo('incfilters', this.options.csvOpts.incfilters,
                        yes, no, Joomla.JText._('COM_FABRIK_INCLUDE_FILTERS')),
                    this._csvYesNo('inctabledata', this.options.csvOpts.inctabledata,
                        yes, no, Joomla.JText._('COM_FABRIK_INCLUDE_DATA')),
                    this._csvYesNo('incraw', this.options.csvOpts.incraw,
                        yes, no, Joomla.JText._('COM_FABRIK_INCLUDE_RAW_DATA')),
                    this._csvYesNo('inccalcs', this.options.csvOpts.inccalcs,
                        yes, no, Joomla.JText._('COM_FABRIK_INCLUDE_CALCULATIONS')),

                ]);
		thisText = Joomla.JText._('COM_FABRIK_SELECT_COLUMNS_TO_EXPORT');
		thisClass = 'opt__' + self.makeSafeForCSS(thisText);	
                jQuery('<div />').prop('class',thisClass)
			.css({'clear':'left','float':'left','white-space':'nowrap','background-color':'bisque','padding':'2px 8px','font-weight':'600','margin-top':'10px'})
			.text(thisText).appendTo(c);
                var g = '';
                var i = 0;
                jQuery.each(this.options.labels, function (k, labelText) {
                    if (k.substr(0, 7) !== 'fabrik_' && k !== '____form_heading') {
                        var newg = k.split('___')[0];
                        if (newg !== g) {
                            g = newg;
			    thisClass = 'opt__' + self.makeSafeForCSS(g);								
                            jQuery('<div />').prop('class',thisClass).css({'clear':'left','font-weight':'600'}).text(g).appendTo(c);
                        }

                        labelText = labelText.replace(/<\/?[^>]+(>|jQuery)/g, '');

                        self._csvYesNo('fields[' + k + ']', true,
                            yes, no, labelText).appendTo(c);
                    }
                    i++;
                });

                // elements not shown in table
                if (this.options.formels.length > 0) {
		    thisText = Joomla.JText._('COM_FABRIK_FORM_FIELDS');
		    thisClass = 'opt__' + self.makeSafeForCSS(thisText);					
		    jQuery('<div />').prop('class',thisClass)
			.css({'clear':'left','float':'left','white-space':'nowrap','background-color':'bisque','padding':'2px 8px','font-weight':'600','margin-top':'10px'})
			.text(thisText).appendTo(c);
                    this.options.formels.each(function (el) {
                        self._csvYesNo('fields[' + el.name + ']', false,
                        yes, no, el.label).appendTo(c);
                    });
                }

                jQuery('<input />').attr({
                    'type' : 'hidden',
                    'name' : 'view',
                    'value': 'table'
                }).appendTo(c);
                jQuery('<input />').attr({
                    'type' : 'hidden',
                    'name' : 'option',
                    'value': 'com_fabrik'
                }).appendTo(c);
                jQuery('<input />').attr({
                    'type' : 'hidden',
                    'name' : 'listid',
                    'value': self.id
                }).appendTo(c);
                jQuery('<input />').attr({
                    'type' : 'hidden',
                    'name' : 'format',
                    'value': 'csv'
                }).appendTo(c);
                jQuery('<input />').attr({
                    'type' : 'hidden',
                    'name' : 'c',
                    'value': 'table'
                }).appendTo(c);

                return c;
            },

            triggerCSVExport: function (start, opts, fields) {
		this.centerCSVWindow(start);				
                var self = this;
                if (start !== 0) {
                    if (start === -1) {
                        // not triggered from front end selections
                        start = 0;
                        opts = self.csvopts;
                        opts.fields = self.csvfields;
                    } else {
                        opts = self.csvopts;
                        fields = self.csvfields;
                    }
                } else {
                    if (!opts) {
                        opts = {};
                        ['incfilters', 'inctabledata', 'incraw', 'inccalcs', 'excel'].each(function (v) {
                            var inputs = self.csvExportForm.find('input[name=' + v + ']');
                            if (inputs.length > 0) {
                                opts[v] = inputs.filter(function () {
                                    return this.checked;
                                })[0].value;
                            }
                        });
                    }
                    // Selected fields
                    if (!fields) {
                        fields = {};
                        self.csvExportForm.find('input[name^=field]').each(function () {
                            if (this.checked) {
                                var k = this.name.replace('fields[', '').replace(']', '');
                                fields[k] = jQuery(this).val();
                            }
                        });
                    }
                    opts.fields = fields;
                    self.csvopts = opts;
                    self.csvfields = fields;
                }

                opts = this.csvExportFilterOpts(opts);

                opts.start = start;
                opts.option = 'com_fabrik';
                opts.view = 'list';
                opts.format = 'csv';
                opts.Itemid = this.options.Itemid;
                opts.listid = this.id;
                opts.listref = this.options.listRef;
                opts.download = 0;
                opts.setListRefFromRequest = 1;

                this.options.csvOpts.custom_qs.split('&').each(function (qs) {
                    var key = qs.split('=');
                    opts[key[0]] = key[1];
                });

                // Append the custom_qs to the URL to enable querystring filtering of the list data
                var myAjax = new Request.JSON({
                    url       : '?' + this.options.csvOpts.custom_qs,
                    method    : 'post',
                    data      : opts,
                    onError   : function (text, error) {
                        fconsole(text, error);
                    },
                    onComplete: function (res) {
			this.centerCSVWindow(start);				
                        if (res.err) {
                            window.alert(res.err);
                            Fabrik.Windows.exportcsv.close();
                        } else {
                            jQuery('#csvcount').text(res.count);
                            jQuery('#csvtotal').text(res.total);
                            jQuery('#csvfile').text(res.file);
                            if (res.count < res.total) {
                                this.triggerCSVExport(res.count);
                            } else {
                                var finalurl = 'index.php?option=com_fabrik&view=list&format=csv&listid=' + this.id +
                                    '&start=' + res.count + '&Itemid=' + this.options.Itemid;
                                var msg = '<div class="alert alert-success" style="padding:10px;margin-bottom:3px"><h3>' + Joomla.JText._('COM_FABRIK_CSV_COMPLETE');
                                msg += '</h3><p><a class="btn btn-success" href="' + finalurl + '">' +
                                    '<i class="icon-download"></i> ' +
                                    Joomla.JText._('COM_FABRIK_CSV_DOWNLOAD_HERE') + '</a></p></div>';
									
                                jQuery('#csvmsg').html(msg);
//undefined error               this.csvWindow.fitToContent(false);

                                document.getElements('input.exportCSVButton').removeProperty('disabled');
                                jQuery('#csvmsg a.btn-success').mouseup(function () {
					jQuery(this).hide();
				});	
								
                                jQuery('#csvmsg a.btn-success').focusout(function () {
                                    Fabrik.Windows.exportcsv.close(true);
                                });

                            }
                        }
                    }.bind(this)
                });
                myAjax.send();
            },

            /**
             * Add filter options to CSV export info
             *
             * @param   objet  opts
             *
             * @return  opts
             */
            csvExportFilterOpts: function (opts) {
                var ii = 0,
                    aa, bits, aName,
                    advancedPointer = 0,
                    testii,
                    usedAdvancedKeys = [
                        'value',
                        'condition',
                        'join',
                        'key',
                        'search_type',
                        'match',
                        'full_words_only',
                        'eval',
                        'grouped_to_previous',
                        'hidden',
                        'elementid'
                    ];

                this.getFilters().each(function (f) {
                    bits = f.name.split('[');
                    if (bits.length > 3) {
                        testii = bits[3].replace(']', '').toInt();
                        ii = testii > ii ? testii : ii;

                        if (f.get('type') === 'checkbox' || f.get('type') === 'radio') {
                            if (f.checked) {
                                opts[f.name] = f.get('value');
                            }
                        } else {
                            opts[f.name] = f.get('value');
                        }
                    }
                }.bind(this));

                ii++;

                Object.each(this.options.advancedFilters, function (values, key) {
                    if (usedAdvancedKeys.contains(key)) {
                        advancedPointer = 0;
                        for (aa = 0; aa < values.length; aa++) {
                            advancedPointer = aa + ii;
                            aName = 'fabrik___filter[list_' + this.options.listRef +
                                '][' + key + '][' + advancedPointer + ']';
                            if (key === 'value') {
                                opts[aName] = this.options.advancedFilters.origvalue[aa];
                            }
                            else if (key === 'condition') {
                                opts[aName] = this.options.advancedFilters.orig_condition[aa];
                            }
                            else {
                                opts[aName] = values[aa];
                            }
                        }
                    }
                }.bind(this));

                return opts;
            },

            addPlugins: function (a) {
                a.each(function (p) {
                    p.list = this;
                }.bind(this));
                this.plugins = a;
            },

            firePlugin: function (method) {
                var args = Array.prototype.slice.call(arguments);
                args = args.slice(1, args.length);
                this.plugins.each(function (plugin) {
                    Fabrik.fireEvent(method, [this, args]);
                }.bind(this));
                return this.result === false ? false : true;
            },

            watchEmpty: function (e) {
                var b = document.id(this.options.form).getElement('.doempty');
                if (b) {
                    b.addEvent('click', function (e) {
                        e.stop();
                        if (window.confirm(Joomla.JText._('COM_FABRIK_CONFIRM_DROP'))) {
                            this.submit('list.doempty');
                        }
                    }.bind(this));
                }
            },

            watchOrder: function () {
                var elementId = false;
                var hs = document.id(this.options.form)
                    .getElements('.fabrikorder, .fabrikorder-asc, .fabrikorder-desc');
                hs.removeEvents('click');
                hs.each(function (h) {
                    h.addEvent('click', function (e) {
                        var img = 'ordernone.png',
                            orderdir = '',
                            newOrderClass = '',
                            bsClassAdd = '',
                            bsClassRemove = '';
                        // $$$ rob in pageadaycalendar.com h was null so reset to e.target
                        h = document.id(e.target);
                        var td = h.getParent('.fabrik_ordercell');
                        if (h.tagName !== 'a') {
                            h = td.getElement('a');
                        }

                        /**
                         * Figure out what we need to change the icon from / to.  We don't know in advance for
                         * bootstrapped templates what icons will be used, so the fabrik-order-header layout
                         * will have set data-sort-foo properties of each of the three states.  Another wrinkle
                         * is that we can't just set the new icon class blindly, because there
                         * may be other classes
                         * on the icon.  For instancee BS3 using Font Awesome will have "fa fa-sort-foo".
                         * So we have
                         * to specifically remove the current class and add the new one.
                         */

                        switch (h.className) {
                            case 'fabrikorder-asc':
                                newOrderClass = 'fabrikorder-desc';
                                bsClassAdd = h.get('data-sort-desc-icon');
                                bsClassRemove = h.get('data-sort-asc-icon');
                                orderdir = 'desc';
                                img = 'orderdesc.png';
                                break;
                            case 'fabrikorder-desc':
                                newOrderClass = 'fabrikorder';
                                bsClassAdd = h.get('data-sort-icon');
                                bsClassRemove = h.get('data-sort-desc-icon');
                                orderdir = '-';
                                img = 'ordernone.png';
                                break;
                            case 'fabrikorder':
                                newOrderClass = 'fabrikorder-asc';
                                bsClassAdd = h.get('data-sort-asc-icon');
                                bsClassRemove = h.get('data-sort-icon');
                                orderdir = 'asc';
                                img = 'orderasc.png';
                                break;
                        }
                        td.className.split(' ').each(function (c) {
                            if (c.contains('_order')) {
                                elementId = c.replace('_order', '').replace(/^\s+/g, '').replace(/\s+$/g, '');
                            }
                        });
                        if (!elementId) {
                            fconsole('woops didnt find the element id, cant order');
                            return;
                        }
                        h.className = newOrderClass;
                        var i = h.getElement('img');
                        var icon = h.firstElementChild;

                        // Swap images - if list doing ajax nav then we need to do this
                        if (this.options.singleOrdering) {
                            document.id(this.options.form)
                                .getElements('.fabrikorder, .fabrikorder-asc, .fabrikorder-desc')
                                .each(function (otherH) {
                                    if (Fabrik.bootstrapped) {
                                        var otherIcon = otherH.firstElementChild;
                                        switch (otherH.className) {
                                            case 'fabrikorder-asc':
                                                otherIcon.removeClass(otherH.get('data-sort-asc-icon'));
                                                otherIcon.addClass(otherH.get('data-sort-icon'));
                                                break;
                                            case 'fabrikorder-desc':
                                                otherIcon.removeClass(otherH.get('data-sort-desc-icon'));
                                                otherIcon.addClass(otherH.get('data-sort-icon'));
                                                break;
                                            case 'fabrikorder':
                                                break;
                                        }
                                    } else {
                                        var i = otherH.getElement('img');
                                        if (i) {
                                            i.src = i.src.replace('ordernone.png', '')
                                                .replace('orderasc.png', '').replace('orderdesc.png', '');
                                            i.src += 'ordernone.png';
                                        }
                                    }
                                });
                        }

                        if (Fabrik.bootstrapped) {
                            icon.removeClass(bsClassRemove);
                            icon.addClass(bsClassAdd);
                        } else {
                            if (i) {
                                i.src = i.src.replace('ordernone.png', '').replace('orderasc.png', '')
                                    .replace('orderdesc.png', '');
                                i.src += img;
                            }
                        }

                        this.fabrikNavOrder(elementId, orderdir);
                        e.stop();
                    }.bind(this));
                }.bind(this));

            },

            getFilters: function () {
                return document.id(this.options.form).getElements('.fabrik_filter');
            },

            storeCurrentValue: function () {
                this.getFilters().each(function (f) {
                    if (this.options.filterMethod !== 'submitform') {
                        f.store('initialvalue', f.get('value'));
                    }
                }.bind(this));
            },

            watchFilters: function () {
                var e = '',
                    self = this,
                    submit = jQuery('#' + this.options.form).find('.fabrik_filter_submit');
                this.getFilters().each(function (f) {
                    e = f.get('tag') === 'select' ? 'change' : 'blur';
                    if (this.options.filterMethod !== 'submitform') {
                        f.removeEvent(e);
                        f.addEvent(e, function (e) {
                            e.stop();
                            if (e.target.retrieve('initialvalue') !== e.target.get('value')) {
                                this.doFilter();
                            }
                        }.bind(this));
                    } else {
                        f.addEvent(e, function (e) {
                            submit[0].highlight('#ffaa00');
                        }.bind(this));
                    }
                }.bind(this));

                // Watch submit if present regardless of this.options.filterMethod
                submit.off();
                submit.on('click', function (e) {
                    e.preventDefault();
                    self.doFilter();
                });
                this.getFilters().addEvent('keydown', function (e) {
                    if (e.code === 13) {
                        e.stop();
                        this.doFilter();
                    }
                }.bind(this));
            },

            doFilter: function () {
                var res = Fabrik.fireEvent('list.filter', [this]).eventResults;
                if (typeOf(res) === 'null') {
                    this.submit('list.filter');
                }
                if (res.length === 0 || !res.contains(false)) {
                    this.submit('list.filter');
                }
            },

            // highlight active row, deselect others
            setActive: function (activeTr) {
                this.list.getElements('.fabrik_row').each(function (tr) {
                    tr.removeClass('activeRow');
                });
                activeTr.addClass('activeRow');
            },

            getActiveRow: function (e) {
                var row = e.target.getParent('.fabrik_row');
                if (!row) {
                    row = Fabrik.activeRow;
                }
                return row;
            },

            watchRows: function () {
                if (!this.list) {
                    return;
                }
                this.rowClicks();
            },

            getForm: function () {
                if (!this.form) {
                    this.form = document.id(this.options.form);
                }
                return this.form;
            },

            uncheckAll: function () {
                this.form.getElements('input[name^=ids]').each(function (c) {
                    c.checked = '';
                });
            },

            submit: function (task) {
                this.getForm();
                var doAJAX = this.options.ajax;
                if (task === 'list.doPlugin.noAJAX') {
                    task = 'list.doPlugin';
                    doAJAX = false;
                }
                if (task === 'list.delete') {
                    var ok = false;
                    var delCount = 0;
                    this.form.getElements('input[name^=ids]').each(function (c) {
                        if (c.checked) {
                            delCount++;
                            ok = true;
                        }
                    });
                    if (!ok) {
                        window.alert(Joomla.JText._('COM_FABRIK_SELECT_ROWS_FOR_DELETION'));
                        Fabrik.loader.stop('listform_' + this.options.listRef);
                        return false;
                    }
                    var delMsg = delCount === 1 ? Joomla.JText._('COM_FABRIK_CONFIRM_DELETE_1')
                        : Joomla.JText._('COM_FABRIK_CONFIRM_DELETE').replace('%s', delCount);
                    if (!window.confirm(delMsg)) {
                        Fabrik.loader.stop('listform_' + this.options.listRef);
                        this.uncheckAll();
                        return false;
                    }
                }
                // We may want to set this as an option - if long page loads feedback that list is doing something might be useful
                // Fabrik.loader.start('listform_' + this.options.listRef);
                if (task === 'list.filter') {
                    Fabrik['filter_listform_' + this.options.listRef].onSubmit();
                    this.form.task.value = task;
                    if (this.form['limitstart' + this.id]) {
                        this.form.getElement('#limitstart' + this.id).value = 0;
                    }
                } else {
                    if (task !== '') {
                        this.form.task.value = task;
                    }
                }
                if (doAJAX) {
                    Fabrik.loader.start('listform_' + this.options.listRef);
                    // For module & mambot
                    // $$$ rob with modules only set view/option if ajax on
                    this.form.getElement('input[name=option]').value = 'com_fabrik';
                    this.form.getElement('input[name=view]').value = 'list';
                    this.form.getElement('input[name=format]').value = 'raw';

                    var data = this.form.toQueryString();

                    if (task === 'list.doPlugin') {
                        data += '&setListRefFromRequest=1';
                        data += '&listref=' + this.options.listRef;
                    }

                    if (task === 'list.filter' && this.advancedSearch !== false) {
                        var advSearchForm = document.getElement('form.advancedSearch_' + this.options.listRef);
                        if (typeOf(advSearchForm) !== 'null') {
                            data += '&' + advSearchForm.toQueryString();
                            data += '&replacefilters=1';
                        }
                    }
                    // Pass the elements that are shown in the list - to ensure they are formatted
                    for (var i = 0; i < this.options.fabrik_show_in_list.length; i++) {
                        data += '&fabrik_show_in_list[]=' + this.options.fabrik_show_in_list[i];
                    }

                    // Add in tmpl for custom nav in admin
                    data += '&tmpl=' + this.options.tmpl;
                    if (!this.request) {
                        this.request = new Request({
                            'url'     : this.form.get('action'),
                            'data'    : data,
                            onComplete: function (json) {
                                json = JSON.decode(json);
                                this._updateRows(json);
                                Fabrik.loader.stop('listform_' + this.options.listRef);
                                Fabrik['filter_listform_' + this.options.listRef].onUpdateData();
                                Fabrik.fireEvent('fabrik.list.submit.ajax.complete', [this, json]);
                                if (json.msg) {
                                    window.alert(json.msg);
                                }
                            }.bind(this)
                        });
                    } else {
                        this.request.options.data = data;
                    }
                    this.request.send();

                    if (window.history && window.history.pushState) {
                        history.pushState(data, 'fabrik.list.submit');
                    }
                    Fabrik.fireEvent('fabrik.list.submit', [task, this.form.toQueryString().toObject()]);
                } else {
                    this.form.submit();
                }
                //Fabrik['filter_listform_' + this.options.listRef].onUpdateData();
                return false;
            },

            fabrikNav: function (limitStart) {
                this.options.limitStart = limitStart;
                this.form.getElement('#limitstart' + this.id).value = limitStart;
                // cant do filter as that resets limitstart to 0
                Fabrik.fireEvent('fabrik.list.navigate', [this, limitStart]);
                if (!this.result) {
                    this.result = true;
                    return false;
                }
                this.submit('list.view');
                return false;
            },

            /**
             * Get the primary keys for the visible rows
             *
             * @since   3.0.7
             *
             * @return  array
             */
            getRowIds: function () {
                var keys = [];
                var d = this.options.isGrouped ? $H(this.options.data) : this.options.data;
                d.each(function (group) {
                    group.each(function (row) {
                        keys.push(row.data.__pk_val);
                    });
                });
                return keys;
            },

            /**
             * Get a single row's data
             *
             * @param   string  id  ID
             *
             * @since  3.0.8
             *
             * @return object
             */
            getRow: function (id) {
                var found = {};
                Object.each(this.options.data, function (group) {
                    for (var i = 0; i < group.length; i++) {
                        var row = group[i];
                        if (row && row.data.__pk_val === id) {
                            found = row.data;
                        }
                    }
                });
                return found;
            },

            fabrikNavOrder: function (orderby, orderdir) {
                this.form.orderby.value = orderby;
                this.form.orderdir.value = orderdir;
                Fabrik.fireEvent('fabrik.list.order', [this, orderby, orderdir]);
                if (!this.result) {
                    this.result = true;
                    return false;
                }
                this.submit('list.order');
            },

            removeRows: function (rowids) {
                // @TODO: try to do this with FX.Elements
                var i;
                for (i = 0; i < rowids.length; i++) {
                    var row = document.id('list_' + this.id + '_row_' + rowids[i]);
                    var highlight = new Fx.Morph(row, {
                        duration: 1000
                    });
                    highlight.start({
                        'backgroundColor': this.options.hightLight
                    }).chain(function () {
                        this.start({
                            'opacity': 0
                        });
                    }).chain(function () {
                        row.dispose();
                        this.checkEmpty();
                    }.bind(this));
                }
            },

            editRow: function () {
            },

            clearRows: function () {
                this.list.getElements('.fabrik_row').each(function (tr) {
                    tr.dispose();
                });
            },

            updateRows: function (extraData) {
                var data = {
                    'option'  : 'com_fabrik',
                    'view'    : 'list',
                    'task'    : 'list.view',
                    'format'  : 'raw',
                    'listid'  : this.id,
                    'group_by': this.options.groupedBy,
                    'listref' : this.options.listRef
                };
                var url = '';
                data['limit' + this.id] = this.options.limitLength;

                if (extraData) {
                    Object.append(data, extraData);
                }

                new Request({
                    'url'        : url,
                    'data'       : data,
                    'evalScripts': false,
                    onSuccess    : function (json) {
                        json = json.stripScripts();
                        json = JSON.decode(json);
                        this._updateRows(json);
                        // Fabrik.fireEvent('fabrik.list.update', [this, json]);
                    }.bind(this),
                    onError      : function (text, error) {
                        fconsole(text, error);
                    },
                    onFailure    : function (xhr) {
                        fconsole(xhr);
                    }
                }).send();
            },

            /**
             * Update headings after ajax data load
             * @param {object} data
             * @private
             */
            _updateHeadings: function (data) {
                var header = jQuery('#' + this.options.form).find('.fabrik___heading').last(),
                    headings = new Hash(data.headings);
                headings.each(function (data, key) {
                    key = '.' + key;
                    try {
                        // $$$ rob 28/10/2011 just alter span to allow for maintaining filter toggle links
                        header.find(key + ' span').html(data);
                    } catch (err) {
                        fconsole(err);
                    }
                });
            },

            /**
             * Grouped data - show all tbodys, then hide empty tbodys (not going to work for none <table> tpls)
             * @private
             */
            _updateGroupByTables: function () {
                var tbodys = jQuery(this.list).find('tbody'), groupTbody;
                tbodys.css('display', '');
                tbodys.each(function (tkey, tbody) {
                    if (!tbody.hasClass('fabrik_groupdata')) {
                        groupTbody = jQuery(tbody).next();
                        if (jQuery(groupTbody).find('.fabrik_row').length === 0) {
                            jQuery(tbody).hide();
                            jQuery(groupTbody).hide();
                        }
                    }
                });
            },

            /**
             * Update list items
             * @param {object} data
             * @private
             */
            _updateRows: function (data) {
                var tbody, itemTemplate, i, groupHeading, columnCount, parent, items = [], item,
                    rowTemplate, cell, cells, form = jQuery(this.form), self = this, fullRow;
                if (typeOf(data) !== 'object') {
                    return;
                }
                if (window.history && window.history.pushState) {
                    history.pushState(data, 'fabrik.list.rows');
                }
                if (!(data.id === this.id && data.model === 'list')) {
                    return;
                }
                this._updateHeadings(data);
                this.setItemTemplate();

                cell = jQuery(this.list).find('.fabrik_row').first();

                if (cell.prop('tagName') === 'TR') {
                    parent = cell;
                    columnCount = 1;
                } else {
                    parent = cell.parent();
                    columnCount = form.find('.fabrikDataContainer').data('cols');
                }

                columnCount = columnCount === undefined ? 1 : columnCount;
                rowTemplate = parent.clone().empty();
                itemTemplate = cell.clone();

                this.clearRows();
                this.options.data = this.options.isGrouped ? $H(data.data) : data.data;

                if (data.calculations) {
                    this.updateCals(data.calculations);
                }
                form.find('.fabrikNav').html(data.htmlnav);
                // $$$ rob was $H(data.data) but that wasnt working ????
                // testing with $H back in again for grouped by data? Yeah works for
                // grouped data!!
                var gdata = this.options.isGrouped || this.options.groupedBy !== '' ? $H(data.data) : data.data;
                var gcounter = 0;
                gdata.each(function (groupData, groupKey) {
                    tbody = self.options.isGrouped ? self.list.getElements('.fabrik_groupdata')[gcounter] : self.tbody;
                    tbody = jQuery(tbody);
                    tbody.empty();

                    // Set the group by heading
                    if (self.options.isGrouped) {
                        groupHeading = tbody.prev();
                        groupHeading.find('.groupTitle').html(groupData[0].groupHeading);
                    }
                    items = [];
                    gcounter++;
                    for (i = 0; i < groupData.length; i++) {
                        var row = $H(groupData[i]);
                        item = self.injectItemData(itemTemplate, row);
                        items.push(item);
                    }

                    items = Fabrik.Array.chunk(items, columnCount);
                    for (i = 0; i < items.length; i++) {
                        if (items[i].length > 0) {
                            // We need to treat <tr>s differently from div templates
                            cells = items[i][0].prop('tagName') === 'TR' ? items[i][0].children() : items[i];
                        } else {
                            cells = items[i];
                        }
                        fullRow = rowTemplate.clone().append(cells);
                        tbody.append(fullRow);
                    }
                });

                this._updateGroupByTables();
                this._updateEmptyDataMsg(items.length === 0);
                this.watchAll(true);
                Fabrik.fireEvent('fabrik.list.updaterows');
                Fabrik.fireEvent('fabrik.list.update', [this, data]);
                this.stripe();
                this.mediaScan();
                Fabrik.loader.stop('listform_' + this.options.listRef);
            },

            _updateEmptyDataMsg: function (empty) {
                var list = jQuery(this.list);
                var fabrikDataContainer = list.parent('.fabrikDataContainer');
                var emptyDataMessage = list.parent('.fabrikForm').find('.emptyDataMessage');
                if (empty) {
                    /*
                     * if (typeOf(fabrikDataContainer) !== 'null') {
                     * fabrikDataContainer.setStyle('display', 'none'); }
                     */
                    emptyDataMessage.css('display', '');
                    /*
                     * $$$ hugh - when doing JSON updates, the emptyDataMessage can be in a td (with no class or id)
                     * which itself is hidden, and also have a child div with the .emptyDataMessage
                     * class which is also hidden.
                     */
                    if (emptyDataMessage.parent().css('display') === 'none') {
                        emptyDataMessage.parent().css('display', '');
                    }
                    emptyDataMessage.parent('.emptyDataMessage').css('display', '');
                } else {
                    fabrikDataContainer.css('display', '');
                    emptyDataMessage.css('display', 'none');
                }
            },

            /**
             * Inject item data into the item data template
             * @param {jQuery} template
             * @param {object} row
             * @return {jQuery}
             */
            injectItemData: function (template, row) {
                var r, cell, c, j;
                jQuery.each(row.data, function (key, val) {
                    cell = template.find('.' + key);
                    if (cell.prop('tagName') !== 'A') {
                        cell.html(val);
                    } else {
                        cell.prop('href', val);
                    }
                });
                template.find('.fabrik_row').prop('id', row.id);
                if (typeof(this.options.itemTemplate) === 'string') {
                    c = template.find('.fabrik_row');
                    c.prop('id', row.id);
                    var newClass = row['class'].split(' ');
                    for (j = 0; j < newClass.length; j++) {
                        c.addClass(newClass[j]);
                    }
                    r = template.clone();
                } else {
                    r = template.find('.fabrik_row');
                }
                return r;
            },

            /**
             * Once a row is added - we need to rescan lightboxes etc to re-attach
             */
            mediaScan: function () {
                if (typeof(Slimbox) !== 'undefined') {
                    Slimbox.scanPage();
                }
                if (typeof(Lightbox) !== 'undefined') {
                    Lightbox.init();
                }
                if (typeof(Mediabox) !== 'undefined') {
                    Mediabox.scanPage();
                }
            },

            addRow: function (obj) {
                var r = new Element('tr', {
                    'class': 'oddRow1'
                });
                for (var i in obj) {
                    if (this.options.headings.indexOf(i) !== -1) {
                        var td = new Element('td', {}).appendText(obj[i]);
                        r.appendChild(td);
                    }
                }
                r.inject(this.tbody);
            },

            addRows: function (aData) {
                var i, j;
                for (i = 0; i < aData.length; i++) {
                    for (j = 0; j < aData[i].length; j++) {
                        this.addRow(aData[i][j]);
                    }
                }
                this.stripe();
            },

            stripe: function () {
                var i;
                var trs = this.list.getElements('.fabrik_row');
                for (i = 0; i < trs.length; i++) {
                    if (!trs[i].hasClass('fabrik___header')) { // ignore heading
                        var row = 'oddRow' + (i % 2);
                        trs[i].addClass(row);
                    }
                }
            },

            checkEmpty: function () {
                var trs = this.list.getElements('tr');
                if (trs.length === 2) {
                    this.addRow({
                        'label': Joomla.JText._('COM_FABRIK_NO_RECORDS')
                    });
                }
            },

            watchCheckAll: function (e) {
                var checkAll = this.form.getElement('input[name=checkAll]'), c, i;
                if (typeOf(checkAll) !== 'null') {
                    // IE wont fire an event on change until the checkbxo is blurred!
                    checkAll.addEvent('click', function (e) {
                        var p = this.list.getParent('.fabrikList') ? this.list.getParent('.fabrikList') : this.list;
                        var chkBoxes = p.getElements('input[name^=ids]');
                        c = !e.target.checked ? '' : 'checked';
                        for (i = 0; i < chkBoxes.length; i++) {
                            chkBoxes[i].checked = c;
                            this.toggleJoinKeysChx(chkBoxes[i]);
                        }
                        // event.stop(); dont event stop as this stops the checkbox being
                        // selected
                    }.bind(this));
                }
                this.form.getElements('input[name^=ids]').each(function (i) {
                    i.addEvent('change', function (e) {
                        this.toggleJoinKeysChx(i);
                    }.bind(this));
                }.bind(this));
            },

            toggleJoinKeysChx: function (i) {
                i.getParent().getElements('input[class=fabrik_joinedkey]').each(function (c) {
                    c.checked = i.checked;
                });
            },

            watchNav: function (e) {
                var limitBox, addRecord;
                if (this.form !== null) {
                    limitBox = this.form.getElement('select[name*=limit]');
                    addRecord = this.form.getElement('.addRecord');
                } else {
                    limitBox = null;
                    addRecord = null;
                }
                if (limitBox) {
                    limitBox.addEvent('change', function (e) {
                        var res = Fabrik.fireEvent('fabrik.list.limit', [this]);
                        if (this.result === false) {
                            this.result = true;
                            return false;
                        }
                        this.doFilter();
                    }.bind(this));
                }
                if (typeOf(addRecord) !== 'null' && (this.options.ajax_links)) {
                    addRecord.removeEvents();
                    var loadMethod = (this.options.links.add === ''
                    || addRecord.href.contains(Fabrik.liveSite)) ? 'xhr' : 'iframe';
                    var url = addRecord.href;
                    url += url.contains('?') ? '&' : '?';
                    url += 'tmpl=component&ajax=1';
                    addRecord.addEvent('click', function (e) {
                        e.stop();
                        // top.Fabrik.fireEvent('fabrik.list.add', this);//for packages?
                        var winOpts = {
                            'id'        : 'add.' + this.id,
                            'title'     : this.options.popup_add_label,
                            'loadMethod': loadMethod,
                            'contentURL': url,
                            'width'     : this.options.popup_width,
                            'height'    : this.options.popup_height
                        };
                        if (typeOf(this.options.popup_offset_x) !== 'null') {
                            winOpts.offset_x = this.options.popup_offset_x;
                        }
                        if (typeOf(this.options.popup_offset_y) !== 'null') {
                            winOpts.offset_y = this.options.popup_offset_y;
                        }
                        Fabrik.getWindow(winOpts);
                    }.bind(this));
                }
                if (document.id('fabrik__swaptable')) {
                    document.id('fabrik__swaptable').addEvent('change', function (e) {
                        window.location = 'index.php?option=com_fabrik&task=list.view&cid=' + e.target.get('value');
                    }.bind(this));
                }
                // All nav links should submit the form, if we dont then filters are not taken into account when
                // building the list cache id
                // Can result in 2nd pages of cached data being shown, but without filters applied
                if (typeOf(this.form.getElement('.pagination')) !== 'null') {
                    var as = this.form.getElement('.pagination').getElements('.pagenav');
                    if (as.length === 0) {
                        as = this.form.getElement('.pagination').getElements('a');
                    }
                    as.each(function (a) {
                        a.addEvent('click', function (e) {
                            e.stop();
                            if (a.get('tag') === 'a') {
                                var o = a.href.toObject();
                                this.fabrikNav(o['limitstart' + this.id]);
                            }
                        }.bind(this));
                    }.bind(this));
                }

                // Not working in J3.2 see
                // http://fabrikar.com/forums/index.php?threads/bug-pagination-not-working-in-chrome.37277
                /*	if (this.options.admin) {
                 Fabrik.addEvent('fabrik.block.added', function (block) {
                 if (block.options.listRef === this.options.listRef) {
                 var nav = block.form.getElement('.fabrikNav');
                 if (typeOf(nav) !== 'null') {
                 nav.getElements('a').addEvent('click', function (e) {
                 e.stop();
                 block.fabrikNav(e.target.get('href'));
                 });
                 }
                 }
                 }.bind(this));
                 }*/
                this.watchCheckAll();
            },

            /**
             * currently only called from element raw view when using inline edit plugin
             * might need to use for ajax nav as well?
             */

            updateCals: function (json) {
                var types = ['sums', 'avgs', 'count', 'medians'];
                this.form.getElements('.fabrik_calculations').each(function (c) {
                    types.each(function (type) {
                        $H(json[type]).each(function (val, key) {
                            var target = c.getElement('.' + key);
                            if (typeOf(target) !== 'null') {
                                target.set('html', val);
                            }
                        });
                    });
                });
            }
        });
        return FbList;
    });
