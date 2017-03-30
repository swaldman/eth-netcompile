var express    = require('express')
var bodyParser = require('body-parser')

var commandLineArgs = require('command-line-args')

var commandLineOptionDefinitions = [
    { "name": 'port', "alias": 'p', "type":Number }
]

var solc = require('solc')

var app = express()

function createError( code, message, meaning, id ) {
    var errorObject = {
	"code"    : code,
	"message" : message,
	"meaning" : meaning
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
    var language   = params.language
    var sourceFile = params.sourceFile

    if ( language == "solidity" ) {
	var rawOutput = solc.compile( sourceFile )
	var contractsSection = rawOutput.contracts

	var out = {}
	for ( var rawContractName in contractsSection ) {
	    var rawValue = contractsSection[rawContractName]
	    var contractName = rawContractName.startsWith(":") ? rawContractName.substring(1) : rawContractName
	    var filteredValue = {
		"code"      : rawValue["bytecode"],
		"metadata"  : rawValue["metadata"]
	    }
	    out[contractName] = filteredValue
	}
	return createSuccess( out, id )
    } else {
	return createError( -32602, "Invalid params", "Unknown language: '" + language + "'", id )
    }
}

var rootHandler = function (req, res) {

    var call = req.body
    
    console.log( call )
    
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
	res.json( doCompile( params, id ) )
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
