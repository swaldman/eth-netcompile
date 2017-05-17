var express    = require('express')
var bodyParser = require('body-parser')

var solc = require('solc')

var commandLineArgs = require('command-line-args')

var partition = require('a-partition')

var Worker = require('webworker-threads').Worker

var commandLineOptionDefinitions = [
    { "name": 'port', "alias": 'p', "type":Number }
]

var app = express()


var rootHandler = function (req, res) {

    var call = req.body
    
    // console.log( call )
    
    var version = call.jsonrpc
    var method  = call.method
    var params  = call.params
    var id      = call.id

    if ( version != "2.0" ) {
	// bad jsonrpc version
	res.json( createError(-32600, "Invalid Request", "Unexpected jsonrpc version '" + version + "'", id ) )
    } else if ( method == "ethdev_getLanguages" ) {
	res.json( createSuccess( ["solidity"], id ) )
    } else if ( method == "ethdev_compile" ) {
	var worker = new Worker( function() {

function createError( code, message, data, id ) {
    var errorObject = {
	"code"    : code,
	"message" : message,
	"data"    : data
    }
    return {
	"jsonrpc" : "2.0",
	"error"   : errorObject,
	"id"      : id
    }
}

function createSuccess( result, id ) {
    return {
	"jsonrpc" : "2.0",
	"result"  : result,
	"id"      : id
    }
}

// TODO: optional compilerVersion, alternative sourceFiles, etc
function doCompile( params, id ) {
    console.log( "In doCompile(...)" )
    
    var compilationInfo = params[0]

    var language   = compilationInfo.language
    var sourceFile = compilationInfo.sourceFile

    if ( language.toUpperCase() === "SOLIDITY" ) {
	var rawOutput = solc.compile( sourceFile )

	console.log( rawOutput )

        let [ warnings, errors ] = ("errors" in rawOutput) ? partition( rawOutput.errors, (elem) => elem.indexOf("Warning:") >= 0 ) : [[],[]]

	// console.log( "warnings:" )
	// console.log( warnings )
	// console.log( "errors:" )
	// console.log( errors )

	if ( errors.length == 0 ) {
	
  	    var contractsSection = rawOutput.contracts

	    var contracts = {}
	    for ( var rawContractName in contractsSection ) {
		var rawValue = contractsSection[rawContractName]
		var contractName = rawContractName.startsWith(":") ? rawContractName.substring(1) : rawContractName
		var filteredValue = {
		    "code"      : rawValue["bytecode"],
		    "metadata"  : rawValue["metadata"]
		}
		contracts[contractName] = filteredValue
	    }
	    var out = {
		"contracts" : contracts,
		"warnings"  : warnings
	    }
	    return createSuccess( out, id )
	} else {
	    return createError( -32602, "Invalid params", rawOutput.errors, id ) // include both errors and warnings
	}
    } else {
	return createError( -32602, "Invalid params", "Unknown language: '" + language + "'", id )
    }
}
	    this.onmessage = function (event) {
		console.log( "Worker thread received event: " + JSON.stringify( event ) )
		var out = doCompile( event.data.params, event.data.id )
		console.log( "Compilation output: " + JSON.stringify( out ) )
		postMessage( out )
	    }
	} )
	worker.onmessage = function (event) {
	    console.log( "Worker wrapper received event: " + event )
	    res.json(event.data);
	};
	console.log( "Sending initial event..." )
	worker.postMessage( { "params" : params, "id" : id } )
	
	// simple, synchronous
	//res.json( doCompile( params, id ) )
    } else {
	// unknown method
	res.json( createError( -32601, "Method not found", "Unexpected method '" + method + "'", id ) )
    }
}

var options = commandLineArgs( commandLineOptionDefinitions )
var port    = options["port"]

app.post('/', bodyParser.json( { "type":"*/*" } ), rootHandler)

app.listen(port, function () {
  console.log('eth-netcompile app listening on port ' + port + '!')
})


// module.exports.sayHi = function() {
//    console.log("Hello!")
// }
