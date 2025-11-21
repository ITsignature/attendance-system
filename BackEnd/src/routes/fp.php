<?php 
header('Content-Type: application/json');
date_default_timezone_set('Asia/Colombo');
$time = time();

// Forward to new smart attendance system
$employee_id = $_GET['finger_print_id'];
$newSystemURL = "https://attendance.itsignaturepvtltd.com/api/api/attendance/fingerprint";
$postData = json_encode([
    'fingerprint_id' => $employee_id // Optional
]);
$ch = curl_init($newSystemURL);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$response = curl_exec($ch);
curl_close($ch);
//$data = json_decode($response, true);
//file_put_contents('response.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));



include('database.php'); 
    $today = date('Y-m-d');
    $dayName = date('l', strtotime($today));
    
    if(!isset($_GET['finger_print_id']) || empty($_GET['finger_print_id'])){ 
        echo json_encode(array('status' => 'error', 'message' => 'Finger print id is required'));
        exit;
    }

    if ($dayName !== 'Sunday') {
        //Check Today is Holiday Or Not
        $finger_print_id = $_GET['finger_print_id'];
        $holidayCheck = mysqli_query($connect, "SELECT * FROM holidays WHERE DATE(hdate) = '$today' AND active = 1");
        if (mysqli_num_rows($holidayCheck) == 0) {

            $get_employees = mysqli_query($connect, "SELECT id, name, username FROM users WHERE no_more != 'Yes' AND attendance_allowed != 1 AND id=$finger_print_id");
            if (mysqli_num_rows($get_employees) != 0) {
                $employee_data = mysqli_fetch_assoc($get_employees);
                $employee_id = $employee_data['id'];
                $employee_name = $employee_data['name'];
                $employee_number = $employee_data['username'];
                
                //Check This Employee is on leave
                $check_employee_leave = mysqli_query($connect, "SELECT * FROM leave_requests WHERE employee_id = '$employee_id' AND start_date <= '$today' AND end_date >= '$today' AND status = 'Approved'");
                if (mysqli_num_rows($check_employee_leave) > 0) {
                    echo json_encode(array('status' => 'error', 'message' => 'Call Jesse to Mark Attendance'));
                    exit;
                }else{
                    //Check This Employee Already Marked Attendance
                    $attCheck = mysqli_query($connect, "SELECT * FROM attendance WHERE userID = '$employee_id' AND att_date = '$today' AND active = 1 AND in_time != '' AND in_time != '00:00:00'");
                    if (mysqli_num_rows($attCheck) > 0) {
                        $attendance_data = mysqli_fetch_assoc($attCheck);
                        $currentHour = date('H');
                        if ($currentHour >= 13) {
                            $in_time = $attendance_data['in_time'];
                            $out_time = date('H:i:s');
                            $employee_id = $_GET['finger_print_id'];
                            $employee_name = $employee_data['name'];
                            $employee_number = $employee_data['username'];

                            // Now calculate hours worked
                            $inTimestamp = strtotime($in_time);
                            $outTimestamp = strtotime($out_time);

                            $workedSeconds = $outTimestamp - $inTimestamp;
                            $workedHours = floor($workedSeconds / 3600);
                            $workedMinutes = floor(($workedSeconds % 3600) / 60);
                            $hours_worked_text = "{$workedHours} hours {$workedMinutes} minutes";
                            $workedTime = gmdate("H:i:s", $workedSeconds); // "gmdate" avoids timezone issues
                            $update_my_leave = "UPDATE attendance SET out_time = '$out_time', working_hours = '$workedTime' WHERE userID = '$employee_id' AND att_date = '$today' AND active = 1 ORDER BY id DESC LIMIT 1";
                            $res = mysqli_query($connect, $update_my_leave);
                            if($res){
                                if ($currentHour >= 17) {
                                    $message = 'Good Bye ' . $employee_data['name'] . '!';
                                } else {
                                    $message = 'You are half-day off ' . $employee_data['name'] . '!';
                                }
                            }
                            // OUT message
                            $text = urlencode("$employee_name attended IT Signature left on $att_date at $out_time. <br><br>Working Hours: $workedTime");
                            $output4 = preg_replace('!\s+!', ' ', $text);
                            $baseurl = "https://www.textit.biz/sendmsg";
                            $url = "$baseurl/?id=942021070701&pw=7470&to=$employee_number&text=$output4&eco=Y";
                            $ret = file($url); 
                            $res= explode(":",$ret[0]);  
                            echo json_encode(array('status' => 'info', 'message' => $message));
                        } else {
                            echo json_encode(array('status' => 'info', 'message' => 'You have already marked attendances'));
                        }
                    }else{
                        $actual_in_time = date('H:i:s');
                        $date = date('Y-m-d');
                        
                        // 8:30:00 strtotime
                        $lateBorder = strtotime("08:30:00");
                        $actualIn = strtotime($actual_in_time);
                        
                        // cecek is late
                        if ($actualIn < $lateBorder) {
                            $in_time = "08:30:00";
                        } else {
                            $in_time = $actual_in_time;
                        }

                        $query = "INSERT INTO attendance (userID, in_time, out_time, att_date, active) VALUES ('$employee_id', '$in_time', '00:00:00', '$date', 1)";
                        $result = mysqli_query($connect, $query);
                        if ($result) {
                            
                            // IN message
                            $lateBorder = strtotime("08:30:00");
                            $actualIn = strtotime($in_time);
                            $employee_name = $employee_data['name'];
                            $employee_number = $employee_data['username'];
                            $sms_time = date('Y-m-d H:i:s');
                            if ($actualIn > $lateBorder) {
                                $lateSeconds = $actualIn - $lateBorder;
                                $lateHours = floor($lateSeconds / 3600);
                                $lateMinutes = floor(($lateSeconds % 3600) / 60);
                                $latemsg = "$lateHours hour $lateMinutes minutes Late";
                            }
                            $text = urlencode("$employee_name attended IT Signature on $date at $in_time.<br><br><br> $latemsg <br>System Time: $sms_time.");
                            $output4 = preg_replace('!\s+!', ' ', $text);
                            $baseurl = "https://www.textit.biz/sendmsg";
                            $url = "$baseurl/?id=942021070701&pw=7470&to=$employee_number&text=$output4&eco=Y";
                            $ret = file($url);
                            $res = explode(":", $ret[0]);
                            //echo "<iframe style='height:1px; width:1px;display: none;' src='$url'></iframe>";
                            echo json_encode(array('status' => 'success', 'message' => 'Welcome ' . $employee_data['name'] . ' !'));
                        } else {
                            echo json_encode(array('status' => 'error', 'message' => 'Failed to mark attendance'));
                            exit;
                        }
                    }
                }
            } else {
                echo json_encode(array('status' => 'error', 'message' => 'You are not allowed to mark attendance'));
            }
        } else{
            echo json_encode(array('status' => 'error', 'message' => 'Today is holiday'));
            exit;
        }
    } else{
        echo json_encode(array('status' => 'error', 'message' => 'Today is Sunday'));
        exit;
    }




?>