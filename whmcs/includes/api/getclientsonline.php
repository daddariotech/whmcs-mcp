<?php
/**
 * GetClientsOnline - custom WHMCS API action used by the WHMCS MCP `get_clients_online` tool.
 *
 * Returns clients whose last client-area login falls inside the last N minutes. This is the
 * same data the admin "Client Activity" widget shows as "Users Online".
 *
 * Install: copy to <whmcs-root>/includes/api/getclientsonline.php, then grant the
 * `GetClientsOnline` permission to the API role used by the MCP server.
 *
 * Read-only: one COUNT and one SELECT on tblclients. IP addresses are never returned.
 *
 * Parameters:
 *   minutes    Look-back window in minutes, 1-10080 (default 60)
 *   limitstart Offset into the result list (default 0)
 *   limitnum   Max clients to return, 1-250 (default 100)
 */

use WHMCS\Carbon;
use WHMCS\Database\Capsule;

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly');
}

$minutesInput = App::getFromRequest('minutes');
$limitStartInput = App::getFromRequest('limitstart');
$limitNumInput = App::getFromRequest('limitnum');

foreach (['minutes' => $minutesInput, 'limitstart' => $limitStartInput, 'limitnum' => $limitNumInput] as $name => $value) {
    if ($value !== '' && $value !== null && !ctype_digit((string) $value)) {
        $apiresults = ['result' => 'error', 'message' => "{$name} must be a whole number"];
        return;
    }
}

$minutes = ($minutesInput === '' || $minutesInput === null) ? 60 : (int) $minutesInput;
$limitStart = ($limitStartInput === '' || $limitStartInput === null) ? 0 : (int) $limitStartInput;
$limitNum = ($limitNumInput === '' || $limitNumInput === null) ? 100 : (int) $limitNumInput;

if ($minutes < 1 || $minutes > 10080) {
    $apiresults = ['result' => 'error', 'message' => 'minutes must be between 1 and 10080'];
    return;
}
if ($limitNum < 1 || $limitNum > 250) {
    $apiresults = ['result' => 'error', 'message' => 'limitnum must be between 1 and 250'];
    return;
}

$now = Carbon::now();
$since = $now->copy()->subMinutes($minutes)->toDateTimeString();

$query = Capsule::table('tblclients')->where('lastlogin', '>', $since);

$total = (int) (clone $query)->count();

$clients = $query
    ->orderBy('lastlogin', 'desc')
    ->orderBy('id', 'asc')
    ->offset($limitStart)
    ->limit($limitNum)
    ->get(['id', 'firstname', 'lastname', 'companyname', 'lastlogin'])
    ->map(function ($row) {
        return [
            'id' => (int) $row->id,
            'firstname' => $row->firstname,
            'lastname' => $row->lastname,
            'companyname' => $row->companyname,
            'lastlogin' => $row->lastlogin,
        ];
    })
    ->all();

$apiresults = [
    'result' => 'success',
    'minutes' => $minutes,
    'since' => $since,
    'servertime' => $now->toDateTimeString(),
    'totalresults' => $total,
    'startnumber' => $limitStart,
    'numreturned' => count($clients),
    'clients' => ['client' => $clients],
];
