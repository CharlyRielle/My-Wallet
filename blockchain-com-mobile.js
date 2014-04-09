isExtension = false;
APP_NAME = 'javascript_blockchain_com_mobile';

$(document).ready(function() {
    MyWallet.setIsMobile(true);
    var isIOSDevice = ( navigator.userAgent.match(/(iPad|iPhone|iPod)/g) ? true : false );
    MyWallet.setIsIOSDevice(isIOSDevice);

    var body = $(document.body);

    var data_root = body.data('root');
    if (data_root)
        root = data_root;

    var data_resource = body.data('resource');
    if (data_resource)
        resource = data_resource;

    //Chrome should automatically grant notification permissions
    MyWallet.setHTML5Notifications(true);

    if (! MyWallet.getIsIOSDevice()) {
        //change type from file to text if device is not iOS
        $(".scanqrinput").attr('type', "text");
    }

    $('#create-account-btn').click(function() {
        $("#landing-container").hide();
        $("#createacct-container").show();
    });

    $('#pair-device-btn').click(function() {
        $("#landing-container").hide();
        $("#restore-wallet").show();
        $("#pairdevice-stage1").show();
    });

    $('#pairdevice-Continue1').click(function() {
        $("#pairdevice-stage1").hide();
        $("#pairdevice-stage2").show();
    });

    $('#pairdevice-Continue2').click(function() {
        $("#pairdevice-stage2").hide();
        $("#pairdevice-stage3").show();
    });

    $('#myModalAddress').on('show', function() {
        var address = document.getElementById("bitcoin-address").innerHTML;

        $('#request-payment-btn').click(function() {
            $('#myModalAddress').modal('hide');
            var modal = $('#myModalQr');
            modal.modal('show');
            loadScript('wallet/jquery.qrcode', function() {
                modal.find('.address-qr-code').empty().qrcode({width: 300, height: 300, text: address});
            });
        });

        $('#archive-address-btn').click(function() {
            MyWallet.archiveAddr(address);
            $('#myModalAddress').modal('hide');
        });

        $('#set-label-btn').click(function() {
            $('#myModalAddress').modal('hide');
            loadScript('wallet/address_modal', function() {
                showLabelAddressModal(address);
            });
        });
    });


    $('#change-password-btn').click(function() {
        $('#password').val($('#change-password').val());
        $('#password2').val($('#change-password2').val());
        $('#update-password-btn').trigger('click');
    });

    $('#active-addresses-table').on('click', '.modal-address', function(){
        var address = $(this).attr('id');
        var addr = document.getElementById("bitcoin-address");
        addr.innerHTML = address;
    });


    function importScannedPrivateKey(value, success, error) {
       try {
            if (value.length == 0) {
                throw  'You must enter a private key to import';
            }

            var format = MyWallet.detectPrivateKeyFormat(value);

            console.log('PK Format ' + format);

            if (format == 'bip38') {
                loadScript('wallet/import-export', function() {

                    MyWallet.getPassword($('#import-private-key-password'), function(_password) {
                        ImportExport.parseBIP38toECKey(value, _password, function(key, isCompPoint) {
                            scanned_key = key;
                            compressed = isCompPoint;

                            if (scanned_key)
                                success(scanned_key);
                            else
                                error(error_msg);

                        }, error);
                    }, error);
                }, error);

                return;
            }

            scanned_key = MyWallet.privateKeyStringToKey(value, format);
            compressed = (format == 'compsipa');

            if (scanned_key == null) {
                throw 'Could not decode private key';
            }
        } catch(e) {
            error_msg = 'Error importing private key ' + e;
        }

        if (scanned_key)
            success(scanned_key);
        else
            error(error_msg);

    }

    $('#import-private-scan').on('click', function (e) {
        MyWallet.getSecondPassword(function() {

            MyWallet.scanQRCode(function(code) {
                  importScannedPrivateKey(code, function (key, compressed) {

                            if (MyWallet.addPrivateKey(key, {compressed : compressed, app_name : IMPORTED_APP_NAME, app_version : IMPORTED_APP_VERSION})) {

                                //Perform a wallet backup
                                MyWallet.backupWallet('update', function() {
                                    MyWallet.get_history();
                                });

                                MyWallet.makeNotice('success', 'added-address', 'Imported Bitcoin Address ' + key.getBitcoinAddress());
                            } else {
                                throw 'Unable to add private key for bitcoin address ' + key.getBitcoinAddress();
                            }

                        }, function(e) {

                            MyWallet.makeNotice('error', 'misc-error', e);
                        });

            }, function(e) {
                MyWallet.makeNotice('error', 'misc-error', e);
            });

        });
    });

    $('#import-address-scan').on('click', function (e) {
        MyWallet.scanQRCode(function(data) {
            importWatchOnlyAddress(data);
        }, function(e) {
            MyWallet.makeNotice('error', 'misc-error', e);
        });
    });

    function importWatchOnlyAddress(value) {
            if (value.length = 0) {
                MyWallet.makeNotice('error', 'misc-error', 'You must enter an address to import');
                return;
            }

            try {
                 var address = new Bitcoin.Address(value);

                 if (address.toString() != value) {
                     throw 'Inconsistency between addresses';
                 }

                    try {
                        if (MyWallet.addWatchOnlyAddress(value)) {
                            MyWallet.makeNotice('success', 'added-address', 'Successfully Added Address ' + address);

                            try {
                                ws.send('{"op":"addr_sub", "addr":"'+address+'"}');
                            } catch (e) { }

                            //Backup
                            MyWallet.backupWallet('update', function() {
                                MyWallet.get_history();
                            });
                        } else {
                            throw 'Wallet Full Or Addresses Exists'
                        }
                    } catch (e) {
                        MyWallet.makeNotice('error', 'misc-error', e);
                    }
            } catch (e) {
                MyWallet.makeNotice('error', 'misc-error', 'Error importing address: ' + e);
                return;
            }
    }
    /*
    $('#overlay').on('click', function (e) {
        $(this).fadeOut();
        e.preventDefault();
    });
    window.mySwipe = new Swipe(document.getElementById('#mySwipe'), {
        continuous: false,
        callback: function(index, elem) {
            document.getElementById('#pagenum').innerHTML=mySwipe.getPos() + 1;
        }
    });

    $('.jumpNext').on('click', function (e) {
        mySwipe.next();
        e.preventDefault();
    });
    */

    $('#camPlaceholder').on('click', function (e) {
        MyWallet.scanQRCode(function(data) {
            console.log('Scanned: ' + data);
            var components = data.split("|");

            var guid = components[0];
            var sharedKey = components[1];
            var password = components[2];

            $('#restore-guid').val(guid);
            $('#restore-password').val(password);
             MyWallet.addEventListener(function(event) {
                 if (event == 'did_set_guid') {
                    $('#restore-wallet-continue').trigger('click');
                 }
             });

            MyWallet.setGUID(guid, false);
        }, function(e) {
            MyWallet.makeNotice('error', 'misc-error', e);
        });
    });

    $("#scanpaircode").on("change", function(event) {
        $('#camPlaceholder').trigger('click');
    });
});


var Mobile = new function() {
    this.loadTemplate = function(name, success, error) {
        $.ajax({
            type: "GET",
            url: '/template',
            data : {format : 'plain', name : name, mobile : true},
            success: function(html) {
                try {
                    $('body').html(html);

                    if (success) success();
                } catch (e) {
                    console.log(e);

                    if (error) error();
                }
            },
            error : function(data) {
                if (error) error();
            }
        });
    }

    function bindTx(tx_tr, tx) {
        tx_tr.click(function(){
            //no TransactionSummaryModal for now
            //openTransactionSummaryModal(tx.txIndex, tx.result);
        });

        return tx_tr;
    }

    function formatOutputMobile(output, myAddresses, addresses_book) {
        function formatOut(addr, out) {
            var myAddr = null;
            if (myAddresses != null)
                myAddr = myAddresses[addr];

            if (myAddr != null) {
                if (myAddr.label != null)
                    return myAddr.label;
                else
                    return addr;
            } else {
                if (addresses_book && addresses_book[addr])
                    return '<a target="new" href="'+root+'address/'+addr+'">'+addresses_book[addr]+'</a>';
                else if (out.addr_tag) {
                    var link = '';
                    if (out.addr_tag_link)
                        link = ' <a class="external" rel="nofollow" href="'+root + 'r?url='+out.addr_tag_link+'" target="new"></a>';

                    return '<a target="new" href="'+root+'address/'+addr+'" class="tag-address">'+addr+'</a> <span class="tag">('+out.addr_tag+link+')</span>';
                } else {
                    return '<a target="new" href="'+root+'address/'+addr+'">'+addr+'</a>';
                }
            }
        }

        //total_fees -= output.value;
        var str = '';

        if (output.type == 0) {
        } else if (output.type == 1 || output.type == 2 || output.type == 3) {
            str = '(<font color="red">Escrow</font> ' + output.type + ' of ';
        } else {
            str = '<font color="red">Strange</font> ';
        }

        if (output.addr != null)
            str += formatOut(output.addr, output);

        if (output.addr2 != null)
            str += ', ' + formatOut(output.addr2, output);

        if (output.addr3 != null)
            str += ', ' + formatOut(output.addr3, output);

        if (output.type == 1 || output.type == 2 || output.type == 3) {
            str += ')';
        }

        str += '<br />';

        return str;
    }

    function getCompactHTML(tx, myAddresses, addresses_book) {
        var result = tx.result;

        var html = '<div class="row rowlines">';
        if (result > 0) {
        	html += '<div class="col-xs-2"> <img class="bound" src="'+resource+'mobile/images/inbound.png" alt="sent"> </div>';
        }
        else if (result < 0) {
        	html += '<div class="col-xs-2"> <img class="bound" src="'+resource+'mobile/images/outbound.png" alt="sent"> </div>';
        }

        html += '<div class="col-xs-8">';

        if (tx.time > 0) {
            html += '<p class="details">' + dateToString(new Date(tx.time * 1000))+ '</p>';
        }

        if (result > 0) {
            html += '<p class="green">'+ formatMoney(result, true)+'</p>';
            html += '<p class="received">Received from:</p>';
        }
        else if (result < 0) {
            html += '<p class="red">'+ formatMoney(result, true)+'</p>';
            html += '<p class="sent">Sent to:</p>';
        }
        else {
            html += '<p>'+ formatMoney(result, true)+'</p>';
            html += '<p class="sent">Between wallet:</p>';
        }

        var all_from_self = true;
        if (result >= 0) {
            for (var i = 0; i < tx.inputs.length; ++i) {
                var out = tx.inputs[i].prev_out;

                if (!out || !out.addr) {
                    all_from_self = false;

                    html += '<span class="label">Newly Generated Coins</span>';
                } else {
                    var my_addr = myAddresses[out.addr];

                    //Don't Show sent from self
                    if (my_addr)
                        continue;

                    all_from_self = false;

                    html += formatOutputMobile(out, myAddresses, addresses_book);
                }
            }
        } else if (result < 0) {
            for (var i = 0; i < tx.out.length; ++i) {
                var out = tx.out[i];

                var my_addr = myAddresses[out.addr];

                //Don't Show sent to self
                if (my_addr && out.type == 0)
                    continue;

                all_from_self = false;

                html += formatOutputMobile(out, myAddresses, addresses_book);
            }
        }

        if (all_from_self)
            html += '<span class="label">Moved Between Wallet</info>';


        html += '</div><div class="col-xs-2 text-right"></div></div>';

        return html;
    };


    //Display The My Transactions view
    this.buildTransactionsView = function buildTransactionsView() {
        var wallet_options = MyWallet.getWalletOptions();
        var transactions = MyWallet.getTransactions();
        var tx_page = MyWallet.getTxPage();
        var addresses = MyWallet.getAddresses();
        var address_book = MyWallet.getAddressBook();

        var interval = null;
        var start = 0;

        if (interval != null) {
            clearInterval(interval);
            interval = null;
        }

        var txcontainer;
        if (wallet_options.tx_display == 0) {
            $('#transactions-detailed-home').hide();
            txcontainer = $('#transactions-compact-home').show().find('tbody').empty();
        } else {
            $('#transactions-compact-home').hide();
            txcontainer = $('#transactions-detailed-home').empty().show();
        }

        if (transactions.length == 0) {
            $('#transactions-detailed, #transactions-compact').hide();
            $('#no-transactions').show();
            return;
        } else {
            $('#no-transactions').hide();
        }

        var buildSome = function() {
            for (var i = start; i < transactions.length && i < (start+MyWallet.getNTransactionsPerPage()); ++i) {
                var tx = transactions[i];

                if (wallet_options.tx_display == 0) {

                    txcontainer.append(bindTx($(getCompactHTML(tx, addresses, address_book)), tx));
                } else {
                    txcontainer.append(tx.getHTML(addresses, address_book));
                }
            }

            start += MyWallet.getNTransactionsPerPage();

            if (start < transactions.length) {
                interval = setTimeout(buildSome, 15);
            } else {
                setupSymbolToggle();

                var pagination = $('.pagination ul').empty();

                if (tx_page == 0 && transactions.length < MyWallet.getNTransactionsPerPage()) {
                    pagination.hide();
                    return;
                } else {
                    pagination.show();
                }

                var pages = Math.ceil(MyWallet.getNTxFiltered() / MyWallet.getNTransactionsPerPage());

                var disabled = ' disabled';
                if (tx_page > 0)
                    disabled = '';

                var maxPagesToDisplay = 10;

                var start_page = Math.max(0, Math.min(tx_page-(maxPagesToDisplay/2), pages-maxPagesToDisplay));

                pagination.append($('<li class="prev'+disabled+'"><a>&larr; Previous</a></li>').click(function() {
                    MyWallet.setPage(tx_page-1);
                }));

                if (start_page > 0) {
                    pagination.append($('<li><a>≤</a></li>').click(function() {
                        MyWallet.setPage(0);
                    }));
                }

                for (var i = start_page; i < pages && i < start_page+maxPagesToDisplay; ++i) {
                    (function(i){
                        var active = '';
                        if (tx_page == i)
                            active = ' class="active"';

                        pagination.append($('<li'+active+'><a class="hidden-phone">'+(i+1)+'</a></li>').click(function() {
                            MyWallet.setPage(i);
                        }));
                    })(i);
                }

                if (start_page+maxPagesToDisplay < pages) {
                    pagination.append($('<li><a>≥</a></li>').click(function() {
                        MyWallet.setPage(pages-1);
                    }));
                }

                var disabled = ' disabled';
                if (tx_page < pages-1)
                    disabled = '';

                pagination.append($('<li class="next'+disabled+'"><a>Next &rarr;</a></li>').click(function() {
                    MyWallet.setPage(tx_page+1)
                }));
            }
        };

        buildSome();
    }



}
