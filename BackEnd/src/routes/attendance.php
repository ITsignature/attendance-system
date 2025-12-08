<?php
ob_start();

// Set the cache expiration time (e.g., 1 week)
$cacheExpiration = 604800;

// Set the content type and cache headers
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: max-age=' . $cacheExpiration);
header('Expires: ' . gmdate('D, d M Y H:i:s', time() + $cacheExpiration) . ' GMT');

?>

<?php 
    if (isset($_GET['id']) && strlen($_GET['id']) > 5) {    echo $_GET['id'] = substr(md5($_GET['id']), 0, 6); } 
?>

<?php require "high-security/ssl/config.php"; ?>
<?php include 'functions/database.php';?>
<?php include 'functions/main.functions.php';

ini_set('date.timezone', 'Asia/Colombo');
date_default_timezone_set('Asia/Colombo');

$actual_link = "$_SERVER[HTTP_HOST]";
$time = time();
$date = date("Y/m/d G:i");

?>

<?php


if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['att_saru'])) {
    // Get the form data
    $att_id = mysqli_real_escape_string($connect, $_POST['att_id']);
    $in_time = mysqli_real_escape_string($connect, $_POST['in_time']);
    $out_time = mysqli_real_escape_string($connect, $_POST['out_time']);
    $added_hours = mysqli_real_escape_string($connect, $_POST['added_hours']);
    
    // Update query
    $query = "
        UPDATE attendance 
        SET in_time = '$in_time', 
            out_time = '$out_time', 
            note = '$added_hours'
        WHERE id = '$att_id'
    ";

    // Execute the query
    // ========== SYNC TO NEW HRMS SYSTEM ==========
  if (mysqli_query($connect, $query)) {
      // Get employee fingerprint_id and attendance details
      $attendanceQuery = "SELECT a.att_date, a.in_time, a.out_time, u.finger_print_id 
                         FROM attendance a 
                         JOIN users u ON a.userID = u.id 
                         WHERE a.id = '$att_id'";
      $attendanceResult = mysqli_query($connect, $attendanceQuery);
      $attendanceData = mysqli_fetch_array($attendanceResult);

      if($attendanceData && $attendanceData['finger_print_id']) {
          $newSystemURL = "https://attendance.itsignaturepvtltd.com/api/api/attendance/manual-sync";

          // Determine if this is insert or update
          $operation = 'update'; // Since att_saru is for editing existing records

          $syncData = json_encode([
              'fingerprint_id' => (int)$attendanceData['finger_print_id'],
              'date' => $attendanceData['att_date'],
              'check_in_time' => $in_time,
              'check_out_time' => $out_time,
              'operation' => $operation
          ]);

          $ch = curl_init($newSystemURL);
          curl_setopt($ch, CURLOPT_POST, 1);
          curl_setopt($ch, CURLOPT_POSTFIELDS, $syncData);
          curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
          curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
          curl_setopt($ch, CURLOPT_TIMEOUT, 5);
          $syncResponse = curl_exec($ch);
          curl_close($ch);
      }

      echo "<script>alert('Attendance updated successfully!');</script>";
  }
  // ========== END SYNC ==========
     else {
        echo "<script>alert('Error updating attendance: " . mysqli_error($connect) . "');</script>";
    }
}
?>


<?php
    if($_SESSION['selected_month']==""){
        $this_month = date('M, Y');
        $_SESSION['selected_month']=$this_month;
    }
    if(isset($_POST['selected_month'])){
        $_SESSION['selected_month']=$_POST['selected_month'];
    }
    
    
    if (isset($_POST['submit'])) {
    // Retrieve form data
    $type = $_POST['ticket_title'];
    $cardCost = $_POST['card_cost']; // New card cost input
    $month = $_POST['monthYear']; // Retrieve the selected month

    // Create a unique code or identifier if needed
    $code = time();

    // Check if the row already exists
    $checkSql = "SELECT * FROM `orders` WHERE `order_name` = '$type'";
    $checkResult = mysqli_query($connect, $checkSql);

    if (mysqli_num_rows($checkResult) == 0) {
        // If no row exists, proceed with insertion
        $sql = "INSERT INTO `orders` (`order_name`, `order_created_by`, `actual_date`, `order_status`, `active`, `order_month`) 
                VALUES ('$type', '$pra_logSyscuruser', '$actual_date', '2', '1', '$month')";
        mysqli_query($connect, $sql);
    } else {
        // Handle the case where the row already exists (optional)
        echo "The record already exists.";
    }

    // Redirect to card_orders2.php
    header("Location: card_orders2.php");
    exit(); // Ensure no further script execution after redirection
}

    

    ?>




<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?php echo $pra_user_name; ?> - ZoomLock with <?php echo $white_label_name; ?></title>
    <!-- Favicon icon -->
    <style type="text/css">
    
    
    
        
        @media (min-width: 992px) { .col-lg-1 {  max-width: 7.6% !important; } }  
        .display_none { display: none ; }
        .form-control {     height: 36px !important; } 
        .table thead th { text-align: left; font-size:10px !important; padding: 3px 5px; }
    
        .table tbody tr td { text-align: left; padding: 3px 5px; }
    
        .menu-toggle .col-lg-1 .user_details .emp_name_new    { display:block !important; }
        .menu-toggle .col-lg-1 .user_details .emp_contact { display:none !important; }
        .menu-toggle .col-lg-1 .user_details img { max-height: 81px; max-width: 81px; }
        .user_details { display: grid; }
    
    
    
    .deznav { display:noneX; }
         #main-wrapper { opacity: 1; }
         #preloader { display:none !important; }

         @media (max-width: 575px) { 
            .col-sm-4 {
                width: 20% !important;
            }
            .col-sm-4 .user_details  { font-size: smaller; }


            
        }

    </style>
    <link rel="icon" type="image/png" sizes="16x16" href="./images/favicon.png">
    <link href="./vendor/owl-carousel/owl.carousel.css" rel="stylesheet">
    <link href="./vendor/bootstrap-select/dist/css/bootstrap-select.min.css" rel="stylesheet">
    <link href="./css/style.css" rel="stylesheet">
    <link href="https://cdn.lineicons.com/2.0/LineIcons.css" rel="stylesheet">
    
    <style>
        .card { height: auto; }      
        .table.table-hover tr:hover {
            background-color: #f6f6f6;
        }
        .bg-info { background-color: #f2ffef !important; } 
        .badge { height: 28px; margin: 3px 0; }
        .table thead th { border:none; }
        .table td { border:none !importantX; }
        .bg-sunday { background-color: #fff7f7 !important; }
        .table td{
            padding: 1px;
            text-align: center;
        }
        .table th{
            padding: 1px;
            text-align: center;
        }
        
    </style>
    
    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.4/css/jquery.dataTables.css" />
  
  
    <link href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.2.0/css/bootstrap.min.css"></link>
    <link href="https://cdn.datatables.net/1.13.4/css/dataTables.bootstrap5.min.css"></link>
    
    <script src="https://code.jquery.com/jquery-3.5.1.js"></script>
    <script src="https://cdn.datatables.net/1.13.4/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.4/js/dataTables.bootstrap5.min.js"></script>

    <style>
      /* Row hover style */
      .highlight-row:hover {
        background-color: #f2f2f2;
      }

      /* Column hover style */
      .highlight-col:hover {
        background-color: #e0e0e0;
      }

      .table-hover tbody tr:hover{
        background-color: #99a5af !important;
      }
    </style>

</head>
<body>

    <!--*******************
        Preloader start
        ********************-->
        <div id="preloader">
            <div class="sk-three-bounce">
                <div class="sk-child sk-bounce1"></div>
                <div class="sk-child sk-bounce2"></div>
                <div class="sk-child sk-bounce3"></div>
            </div>
        </div>
    <!--*******************
        Preloader end
        ********************-->

    <!--**********************************
        Main wrapper start
        ***********************************-->
        <div id="main-wrapper" class="menu-toggle">

        <!--**********************************
            Nav header start
            ***********************************-->
            <div class="nav-header">
                <a href="/" class="brand-logo">
                    <img class="logo-abbr" src="./images/logo.png" alt="">
                    <img class="logo-compact" src="./images/logo-text.png" alt="">
                    <img class="brand-title" src="./images/logo-text.png" alt="">
                </a>

                <div class="nav-control">
                    <div class="hamburger">
                        <span class="line"></span><span class="line"></span><span class="line"></span>
                    </div>
                </div>
            </div>
        <!--**********************************
            Nav header end
            ***********************************-->

            <?php echo left_bar(); ?>

            <?php echo top_menu(); ?>


    <!--**********************************
            Content body start
            ***********************************-->
            
            
            <!-- manual leaving -->
            <?php
            if (isset($_POST['save_leaving_time']) && $_POST['attendance_id'] != "") {  

                $userid=mysqli_real_escape_string($connect, $_GET['info']);

                $att_date=$_POST[leaving_date]; 
                $out_time=$_POST[leaving_time].':00'; 
                
                $sqlchk="SELECT * FROM attendance where userID='$userid' and att_date='$att_date' and active='1'  AND out_time = '00:00:00' AND id = '$_POST[attendance_id]' ";
                $exechk=mysqli_query($connect, $sqlchk);
                $count=mysqli_num_rows($exechk);
                $pray = mysqli_fetch_array($exechk) ;


                $date1=date_create("$pray[in_time]");
                $date2=date_create("$out_time");
                $diff=date_diff($date1,$date2);
                $caltime= $diff->format("%H:%i:%s");


                if($count != '0' && $count != ''){
                $entered_by=$_SESSION['logSyscuruser'];

                    $sqlupdate="UPDATE attendance SET out_time = '$out_time', working_hours='$caltime', manual_attendance_out_time_marked = '$entered_by - $date' where userID='$userid' and att_date='$att_date' and active='1' AND id = '$_POST[attendance_id]' ";
                    $exeupdate=mysqli_query($connect, $sqlupdate);

                    // ========== SYNC TO NEW HRMS SYSTEM ==========
  if($exeupdate){
      // Get employee fingerprint_id
      $fingerprintQuery = "SELECT finger_print_id FROM users WHERE id = '$userid'";
      $fingerprintResult = mysqli_query($connect, $fingerprintQuery);
      $fingerprintData = mysqli_fetch_array($fingerprintResult);

      if($fingerprintData && $fingerprintData['finger_print_id']) {
          $newSystemURL = "https://attendance.itsignaturepvtltd.com/api/api/attendance/manual-sync";

          $syncData = json_encode([
              'fingerprint_id' => (int)$fingerprintData['finger_print_id'],
              'date' => $att_date,
              'check_in_time' => $pray['in_time'],
              'check_out_time' => $out_time,
              'operation' => 'update'
          ]);

          $ch = curl_init($newSystemURL);
          curl_setopt($ch, CURLOPT_POST, 1);
          curl_setopt($ch, CURLOPT_POSTFIELDS, $syncData);
          curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
          curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
          curl_setopt($ch, CURLOPT_TIMEOUT, 5);
          $syncResponse = curl_exec($ch);
          curl_close($ch);

          // Optional: Log the response
          // error_log("HRMS Sync UPDATE: " . $syncResponse);
      }
  }
  // ========== END SYNC ==========
                        ?>
                           <?php
                                        $sql = "SELECT * FROM  users WHERE id = '$userid' ";
                                        $result = mysqli_query($connect, $sql);
                                        $prax = mysqli_fetch_array($result) ;
                                        $to = $prax[username];

                                     //   $text = "$prax[name] Manually Leaved from IT Signature - $att_date $out_time <br><br><br>Working Hours : $caltime";
                                     $text = "$prax[name] manually left IT Signature on $att_date at $out_time.<br><br><br>Working Hours: $caltime";



                                        $output4 = preg_replace('!\s+!', ' ', $text);
                                        $baseurl ="https://www.textit.biz/sendmsg";
                                        $url = "$baseurl/?id=942021070701&pw=7470&to=$to&text=$output4&eco=Y";           
                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$url'></iframe>";

                                        $urlX = "$baseurl/?id=942021070701&pw=7470&to=0773966920&text=$output4&eco=Y";   
                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$urlX'></iframe>";

                            ?>

                        <div class="alert alert-success" role="alert" style="margin: 40px 0 0 0 ;">
                            <?php echo $prax[name]; ?> Manual Leaving Marked Succssfully! 
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>


                        <?php
                    } 
                } else { ?> 
                        <div class="alert alert-danger" role="alert" style="margin: 40px 0 0 0;">
                            Sorry! Manual Leaving already marked.
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div> <?php }
            }
            ?>

            <!-- manual leaving -->

































            
            <?php


            if ($_SESSION[session_leaving_attendance] == "Leaving") { 
            if ((isset($_GET['id']) && $_GET['id'] != "") || (isset($_POST['attendending_user']) && $_POST['attendending_user'] != "")) {  

                if(isset($_POST['attendending_user'])) { $_GET['id'] = $_POST['attendending_user']; }
                $userid=mysqli_real_escape_string($connect, $_GET['id']);
                $att_date=date("Y-m-d");
                $additional_hours = isset($_POST['additional_hours']) ? mysqli_real_escape_string($connect, $_POST['additional_hours']) : '0';

                if(isset($_GET[newtime])) {
                    $out_time=$_GET[newtime].':00'; 
                } else {
                    $out_time=date("H:i:s"); 
                }
                

                $sqlchk="SELECT * FROM attendance where userID='$userid' and att_date='$att_date' and active='1'  AND out_time = '00:00:00' ";
                $exechk=mysqli_query($connect, $sqlchk);
                $count=mysqli_num_rows($exechk);
                $pray = mysqli_fetch_array($exechk) ;


                $date1=date_create("$pray[in_time]");
                $date2=date_create("$out_time");
                $diff=date_diff($date1,$date2);
                $caltime= $diff->format("%H:%i:%s");
                


                if($count != '0' && $count != ''){

                    $sqlupdate="UPDATE attendance SET out_time = '$out_time', note = '$additional_hours', working_hours='$caltime' where userID='$userid' and att_date='$att_date' and active='1'";
                    $exeupdate=mysqli_query($connect, $sqlupdate);
                    if($exeupdate){
                        ?>
                           <?php
                                        $sql = "SELECT * FROM  users WHERE id = '$userid' ";
                                        $result = mysqli_query($connect, $sql);
                                        $prax = mysqli_fetch_array($result) ;
                                        $to = $prax[username];

                                      //  $text = "$prax[name] Leaved from IT Signature - $att_date $out_time <br><br><br>Working Hours : $caltime";
                                        $text = "$prax[name] left IT Signature on $att_date at $out_time.<br><br><br>Working Hours: $caltime";



                                        $output4 = preg_replace('!\s+!', ' ', $text);
                                        $baseurl ="https://www.textit.biz/sendmsg";
                                        $url = "$baseurl/?id=942021070701&pw=7470&to=$to&text=$output4&eco=Y";
                                        //$ret = file($url);     $res= explode(":",$ret[0]);                                          

                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$url'></iframe>";


                                        $urlX = "$baseurl/?id=942021070701&pw=7470&to=0773966920&text=$output4&eco=Y";                 

                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$urlX'></iframe>";

                                        $url2 = "attendance.php";
                                        //echo '<meta http-equiv="refresh" content="3;url=' . $url2 . '">';

                            ?>

                        <div class="alert alert-success" role="alert" style="margin: 40px 0 0 0 ;">
                            <?php echo $prax[name]; ?> Leaving Marked Succssfully!
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>


                        <?php
                    } 
                } else { ?> 
                        <div class="alert alert-danger" role="alert" style="margin: 40px 0 0 0;">
                            Sorry! Leaving already marked.
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div> <?php }
            } }




            ### ==================================================================================================================



            if ($_SESSION[session_leaving_attendance] == "Attendance") { 
            if ((isset($_GET['id']) && $_GET['id'] != "") || (isset($_POST['attendending_user']) && $_POST['attendending_user'] != "")) { 
                
                if(isset($_POST['attendending_user'])) { $_GET['id'] = $_POST['attendending_user']; }
                $userid=mysqli_real_escape_string($connect, $_GET['id']);
                
                //$userid=$_GET['employee'];
                $entered_by=$_SESSION['logSyscuruser'];
                $att_date=date("Y-m-d");
                $in_time=date("H:i:s");
                $out_time="00:00:00";
                
                $date1=date_create("$in_time");
                $date2=date_create("$out_time");
                $diff=date_diff($date1,$date2);
                $caltime= $diff->format("%H:%i:%s");
                
                $working_type="FullDay";
                $reason="";
                $code=time();
                $late_reason="";
                $late_pay="";
                $ot_pay="";
                $note="";
                $active='1';
                
                
                $sqlchk="SELECT * FROM attendance where userID='$userid' and att_date='$att_date' and active='1'   ";
                $exechk=mysqli_query($connect, $sqlchk);
                $count=mysqli_num_rows($exechk);
                if($count != '0' && $count != ''){
                  ?>
                        <div class="alert alert-danger" role="alert" style="margin: 40px 0 0 0;">
                            Sorry! Attendance already marked.
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>
                        <?php
                                        $url2 = "attendance.php";
                                        //echo '<meta http-equiv="refresh" content="3;url=' . $url2 . '">';
                }else{

                    if(isset($_GET[newtime])) { 
                        echo $addsql="INSERT INTO attendance VALUES (null, '$userid','$entered_by','$att_date', '$_GET[newtime]:00', '$out_time', '$caltime2', '$working_type', '$reason','$code','$late_reason', '0', '0', '', '$active', '', '' )";
                        $addexe=mysqli_query($connect, $addsql);

                        $sms_time = $_GET[newtime].':00';
                    } else { 
                        echo $addsql="INSERT INTO attendance VALUES (null, '$userid','$entered_by','$att_date', '$in_time', '$out_time', '$caltime2', '$working_type', '$reason','$code','$late_reason', '0', '0', '', '$active', '', '' )";
                        $addexe=mysqli_query($connect, $addsql);    

                        $sms_time = $in_time;
                        }




                    // ========== SYNC TO NEW HRMS SYSTEM ==========
  if($addexe){
      // Get employee fingerprint_id
      $fingerprintQuery = "SELECT finger_print_id FROM users WHERE id = '$userid'";
      $fingerprintResult = mysqli_query($connect, $fingerprintQuery);
      $fingerprintData = mysqli_fetch_array($fingerprintResult);

      if($fingerprintData && $fingerprintData['finger_print_id']) {
          $newSystemURL = "https://attendance.itsignaturepvtltd.com/api/api/attendance/manual-sync";

          $syncData = json_encode([
              'fingerprint_id' => (int)$fingerprintData['finger_print_id'],
              'date' => $att_date,
              'check_in_time' => isset($_GET['newtime']) ? $_GET['newtime'] : substr($in_time, 0, 8),
              'check_out_time' => ($out_time != '00:00:00') ? $out_time : null,
              'operation' => 'insert'
          ]);

          $ch = curl_init($newSystemURL);
          curl_setopt($ch, CURLOPT_POST, 1);
          curl_setopt($ch, CURLOPT_POSTFIELDS, $syncData);
          curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
          curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
          curl_setopt($ch, CURLOPT_TIMEOUT, 5);
          $syncResponse = curl_exec($ch);
          curl_close($ch);

          // Optional: Log the response
          // error_log("HRMS Sync INSERT: " . $syncResponse);
      }
  }
  // ========== END SYNC ==========

                        ?>
                        <?php
                                        $sql = "SELECT * FROM  users WHERE id = '$userid' ";
                                        $result = mysqli_query($connect, $sql);
                                        $prax = mysqli_fetch_array($result) ;
                                        $to = $prax[username];

                                       if ($sms_time > $prax['zoom_first_name']) {
                                            $attended_time = date_create($sms_time);
                                            $office_time_start = date_create($prax['zoom_first_name']);
                                            $difference = date_diff($attended_time, $office_time_start);
                                            $hours = $difference->format("%H");
                                            $minutes = $difference->format("%i");

                                            $late_time = '';

                                            if ($hours > 0) {
                                                $late_time .= $hours . ' Hour';
                                                if ($hours > 1) {
                                                    $late_time .= 's';
                                                }
                                                $late_time .= ' ';
                                            }

                                            if ($minutes > 0) {
                                                $late_time .= $minutes . ' Minute';
                                                if ($minutes > 1) {
                                                    $late_time .= 's';
                                                }
                                            }

                                            $late_time .= ' Late';

                                            $latemsg = '<br><br><br>' . $late_time;




                                            if($sms_time != $in_time) {
                                                $manual_or_system_time_msg = 'System Time : '.$in_time.'';
                                            }
                                            $manual_or_system_time = '<br>' . $manual_or_system_time_msg;


                                            $today_day=date("l");
                                            $lastdate=date("t");
                                            $yearmonth=date("Y-m");
                                            $workingdays=0;
                                            for($w=1; $w<=$lastdate; $w++){
                                                $fulldate=$yearmonth."-".$w;
                                                if(date("l", strtotime($fulldate))!="Sunday"){
                                                    $workingdays+=1;
                                                }
                                            }
                                            /*HOLIDAYS CALCULATIONS*/
                                            for($w=1; $w<=$lastdate; $w++){
                                                $fulldate=$yearmonth."-".$w;
                                                if(date("l", strtotime($fulldate))!="Sunday"){
                                                    $sqlholiday="SELECT id FROM holidays WHERE hdate='$fulldate' and active='1'";
                                                    $exeholiday=mysqli_query($connect, $sqlholiday);
                                                    if(mysqli_num_rows($exeholiday)==1){
                                                        $workingdays-=1;
                                                    }
                                                }
                                            }

                                            //echo "here ". $workingdays;
                                            $basicSalary_for_late_msg=$prax[online_payment];

                                            $today_fulldate=date("Y-m-d");

                                            $zoom_first_name = $prax[zoom_first_name];
                                            $start_time = strtotime($today_fulldate." ".$zoom_first_name); //echo '<br>';
                                            $end_time = strtotime($today_fulldate." ".$in_time);// echo '<br>';

                                            if($end_time>$start_time){
                                                echo $latediff= round(abs($end_time - $start_time) / 60,2);
                                            }else{
                                                echo $latediff=0;
                                            }
                                            if($today_day=="Saturday"){
                                                $laterate .= '<br><br><br>Late : ';
                                                $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['send_pin_code_automatically']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                $laterate .=round(($basicSalary_for_late_msg/($workingdays*$timeDiffMinutes))*$latediff);
                                            }elseif($today_day=="Sunday"){
                                                $laterate .= '<br><br><br>Late : ';
                                                $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                $laterate .=round(($basicSalary_for_late_msg/($workingdays*$timeDiffMinutes))*$latediff);
                                            }else{
                                                $laterate .= '<br><br><br>Late : ';
                                                $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                $laterate .=round(($basicSalary_for_late_msg/($workingdays*$timeDiffMinutes))*$latediff);
                                            }


                                        }

                                        $laterate = '';


                                      //  $text = "$prax[name] Attended to IT Signature - $att_date $sms_time $latemsg $manual_or_system_time $laterate";
                                        $text = "$prax[name] attended IT Signature on $att_date at $sms_time. $latemsg $manual_or_system_time $laterate.";



                                        $output4 = preg_replace('!\s+!', ' ', $text);
                                        $baseurl ="https://www.textit.biz/sendmsg";
                                        $url = "$baseurl/?id=942021070701&pw=7470&to=$to&text=$output4&eco=Y";
                                        //$ret = file($url);     $res= explode(":",$ret[0]);                                          

                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$url'></iframe>";


                                        $urlX = "$baseurl/?id=942021070701&pw=7470&to=0773966920&text=$output4&eco=Y";                 

                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$urlX'></iframe>";

                                        $url2 = "attendance.php";
                                        //echo '<meta http-equiv="refresh" content="3;url=' . $url2 . '">';

                            ?>

                        <div class="alert alert-success" role="alert" style="margin: 40px 0 0 0 ;">
                            <?php echo $prax[name]; ?> Attendance Marked Succssfully!
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>

<?php
                    }else{
                        ?>
                        <div class="alert alert-warning" role="alert" style="margin: 40px 0 0 0 ;">
                            Error: <?php echo mysqli_error($connect); ?>
                            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>
                        <?php
                    }

                }
            } }
            
            ?>
            
            
            
            
            
            <div class="content-body">
                <!-- row -->
                <div class="container-fluid">

                    <div class="">
                    <div class="row" style="padding: 0px">
                       
 
 
 
 
 
 
 
                  




<div class=" col-sm-6 col-md-3" >

<div class="card" style="padding:15px">
 <style>
     #preview { transform: scaleX(1) !important; width: 100%; min-width: 320px; height: 280px; object-fit: cover; margin-top: 10px; border-radius: 5px; }
 </style>

    <form action="" method="get" style=" width: 100%; margin-bottom: 20px; display: initial;">
        <input type="time" name="newtime" value="<?php if (isset($_GET[newtime])) { echo $_GET[newtime]; }  else { echo date("H:i"); } ?>" required style=" width: 30%; float: left; " class="form-control">
        <input type="submit" value="Set Time" name="set_new_time_submit" class="btn btn-primary btn-rounded" style=" float: right; height: 36px; line-height: 0px; border-radius: 10px !important; ">
        
    </form>
   

    <h5 style="text-align: center;color: #a8a8a8;font-size: 13px;width: 100%;display: block;text-transform: uppercase;     margin-bottom: 0px;">

        <?php echo $_SESSION[session_leaving_attendance]; ?><br>


        <?php if($_SESSION[session_camera_back_or_front] == 'front') { echo ' Front Camera'; } ?>
        <?php if($_SESSION[session_camera_back_or_front] == 'back') { echo ' Back Camera'; } ?>

    </h5> 
    
    <video id="preview"></video>

    <?php 
        if (isset($_GET['set_new_time_submit'])) { 
            $newtime = 'newtime=' . $_GET['newtime'] . '&';
        } 
    ?>
    <script type="text/javascript">
    window.addEventListener('DOMContentLoaded', (event) => {
        let scanner = new Instascan.Scanner({ video: document.getElementById('preview') });

        scanner.addListener('scan', function(content) {
            window.location.href="attendance.php?<?php echo $newtime; ?>&id="+content;
        });

        Instascan.Camera.getCameras().then(function(cameras) {
            if (cameras.length > 0) {
                let backCamera = cameras.find(camera => camera.name.includes('<?php echo $_SESSION[session_camera_back_or_front]; ?>'));
                scanner.start(backCamera || cameras[0]);
            } else {
                console.error('No cameras found.');
            }
        }).catch(function(e) {
            console.error(e);
        });
    });
</script>

    
<form action="" method="post" style="width: 100%; margin-top: 10px; margin-bottom: 0px; display: flow-root;">
    
    <select name="attendance_or_leaving" required style="width: 100%; float: left;" class="form-control" onchange="this.form.submit()">
        <option <?php if($_SESSION['session_leaving_attendance'] == 'Attendance') { echo 'selected'; } ?>>Attendance</option>
        <option <?php if($_SESSION['session_leaving_attendance'] == 'Leaving') { echo 'selected'; } ?>>Leaving</option>
    </select>
    <p></p>
    <select name="using_camera" required style="width: 100%; float: left; margin-top: 10px;" class="form-control" onchange="this.form.submit()">
        <option <?php if($_SESSION['session_camera_back_or_front'] == 'front') { echo 'selected'; } ?> value="front">Front Camera</option>
        <option <?php if($_SESSION['session_camera_back_or_front'] == 'back') { echo 'selected'; } ?> value="back">Back Camera</option>
    </select>

    <select name="attendending_user" style="width: 100%; float: left; margin-top: 20px;" class="form-control">
        <option value="">No QR?</option>
        <?php 
        if ($pra_user_user_level == '1' || $pra_user_user_level == '2') { 
            $sql_users = "SELECT * FROM users WHERE no_more != 'Yes' AND user_level != '5' ORDER BY user_level, id DESC";
        } else { 
            $sql_users = "SELECT * FROM users WHERE no_more != 'Yes' AND user_level != '5' AND id = '$_SESSION[logSyscuruser]' ORDER BY user_level, id DESC";
        }
        $result_users = mysqli_query($connect, $sql_users);
        while ($prax_users = mysqli_fetch_array($result_users)) {
            $rowname = $prax_users['name'];
            $rowid = $prax_users['id'];
        ?>
        <option <?php if(isset($_POST['mark_attendance_without_qr']) && $_POST['attendending_user'] == $rowid) { echo 'selected'; } ?> value="<?php echo $rowid; ?>"><?php echo $rowname; ?></option>
        <?php } ?>
    </select>

    <!-- Additional hours input -->
    
    <input type="number" name="additional_hours" id="additional_hours" min="0" step="0.5" placeholder="Enter additional hours" style="width: 100%; float: left; margin-top: 5px;" class="form-control">

    <input type="submit" value="Mark Attendance Manually" name="mark_attendance_without_qr" class="btn btn-primary btn-rounded" style="width: 100%; margin-top:10px; height: 36px; line-height: 0px; border-radius: 10px !important;" onclick="return validateAttendance()">
</form>


<script>
  function validateAttendance() {
    var selectElement = document.getElementsByName("attendending_user")[0];
    if (selectElement.value === "") {
      alert("Team Member not Selected?");
      return false;
    }
    return true;
  }
</script>
    
    </div>
</div>














              
              
              
              
<div class="col-sm-12 col-md-6" style="overflow-x: scroll;">

<div class="card" style="padding:15px">





    <!-- ERP SALART SHEET -->
    <?php
    if(isset($_GET['info']) && $_GET['info']!=""){


        $sqluser_selected_user="SELECT * FROM users where id = '$_GET[info]' ";
        $exeuser_selected_user=mysqli_query($connect, $sqluser_selected_user);
        $rowuser_selected_user=mysqli_fetch_array($exeuser_selected_user);


      if($rowuser_selected_user[user_level] == '1') { $selected_user_role = "Director"; } 
      if($rowuser_selected_user[user_level] == '2') { $selected_user_role = "Manager"; } 
      if($rowuser_selected_user[user_level] == '3') { $selected_user_role = "Team Member"; } 
      if($rowuser_selected_user[user_level] == '4') { $selected_user_role = "Call Center"; } 
      if($rowuser_selected_user[user_level] == '5') { $selected_user_role = "SSN"; } 

    ?>
            <div class="row" style="margin-bottom: 10px;">
                    <div class="col-sm-3 col-lg-3" style="">
                        <?php if($rowuser_selected_user[profile_picture] != '') { echo '<img src="images/profile_picture/'.$rowuser_selected_user[profile_picture].'" style="max-height:45px; max-width: 45px;     border-radius: 50%;  border:1px solid; filter: grayscale(0%); width:100% ">'; } else { echo '<img src="https://cdn.onlinewebfonts.com/svg/img_546302.png" style="max-height:45px; max-width: 45px; border-radius: 50%;  width:100% ">'; }  ?>
                    </div>

                    <div class="col-sm-5 col-lg-5">
                         <span class="emp_name_new" style="padding: 2px 5px;border-radius: 5px; font-size: 13px; text-transform: uppercase;"><?php echo $rowuser_selected_user[name]; ?></span><br>
                         <span class="emp_name_new" style="padding: 2px 5px;border-radius: 5px; font-size: 13px; text-transform: uppercase;"><?php echo $selected_user_role; ?></span>
                    </div>
                    <div class="col-sm-4 col-lg-4">
                         <span class="emp_contact" style="font-size: 10px; "><?php echo $rowuser_selected_user[username]; ?> </span>
                    </div>
            </div>



    <table class="table table-sm table-bordered" id="dataTables-example2" style="font-size: 12px; background: white ">
        <thead>
            <tr>
                <th>Date</th>
                <th>Weekday</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Work Time</th>
                <th>Late Min</th>
                <th>OT Min</th>
            </tr>
        </thead>
        <tbody>
            <?php
            //echo "1st ".$_SESSION['selected_month'];
            $yearmonth=date("Y-m", strtotime("1st ".$_SESSION['selected_month']));
            $lastdate=date("t", strtotime($_SESSION['selected_month']));

            // Get Working days of month
            $workingdays=0;
            for($w=1; $w<=$lastdate; $w++){
                $fulldate=$yearmonth."-".$w;
                if(date("l", strtotime($fulldate))!="Sunday"){
                    //echo "<br>##".$fulldate;
                    $workingdays+=1;
                }
            }
            //echo " here2 ".$workingdays;

            /*HOLIDAYS CALCULATIONS*/
            for($w=1; $w<=$lastdate; $w++){
                $fulldate=$yearmonth."-".$w;
                if(date("l", strtotime($fulldate))!="Sunday"){
                    $sqlholiday="SELECT id FROM holidays WHERE hdate='$fulldate' and active='1'";
                    $exeholiday=mysqli_query($connect, $sqlholiday);
                    if(mysqli_num_rows($exeholiday)==1){
                        $workingdays-=1;
                    }
                }
            }
            //echo " here4 ".$workingdays;

            $totallaterate=0;
            $totalotrate=0;
            $totalleaverate=0;

            $todaysal=0;

            for($x=1; $x<=$lastdate; $x++){
                    $fulldate=$yearmonth."-".$x;
                    $weekday=date("l", strtotime($fulldate));
                ?>
                
                    <?php
                    /* Theesan Calculation */
                    
                    ### Check Attendance
                    $sqlatt="SELECT * FROM attendance where userID='$_GET[info]' and att_date ='$fulldate' and active='1'";
                    $exeatt=mysqli_query($connect, $sqlatt);
                    if(mysqli_num_rows($exeatt)>=1){
                        $rowatt=mysqli_fetch_array($exeatt);
                        $att_id=$rowatt['id'];
                        /*Variable Set*/
                        $record=true;
                        $holiday="no";
                        $in_time=$rowatt['in_time'];
                        $out_time=$rowatt['out_time'];
                        $working_hours=$rowatt['working_hours'];
                        $working_type=$rowatt['working_type'];
                        $status=$rowatt['late_reason'];
                        $late_pay=$rowatt['late_pay'];
                        $ot_pay=$rowatt['ot_pay'];
                        $leaverate=0;
                        /*Variable Set*/

                        // Late minutes
                        //$start_time = strtotime($fulldate." 08:30:00");
                        $start_time = strtotime($fulldate." ".$rowuser_selected_user['zoom_first_name']);
                        $end_time = strtotime($fulldate." ".$in_time);
                        if($end_time > $start_time){
                            $latediff= round(abs($end_time - $start_time) / 60,2);
                        }else{
                            $latediff=0;
                        }

                        $worktime=round((abs(strtotime($fulldate." ".$out_time)) - abs(strtotime($fulldate." ".$in_time))) /3600,2);

                        ### Check Holidays
                        $sqlholi="SELECT * FROM holidays WHERE hdate='$fulldate' and active='1'";
                        $exeholi=mysqli_query($connect, $sqlholi);
                        if(mysqli_num_rows($exeholi)>=1){
                            $holiday="yes";
                        }

                        if($weekday=="Sunday"){
                            $holiday="sunday";
                        }



                        // OT Minutes
                        if($weekday=="Saturday"){
                            $start_time2 = strtotime($fulldate." 13:00:00");
                            $end_time2 = strtotime($fulldate." ".$out_time);
                            if($end_time2>$start_time2){
                                $otdiff= round(abs($end_time2 - $start_time2) / 60,2);
                            }else{
                                $otdiff=0;
                            }
                        }else{
                            $start_time2 = strtotime($fulldate." 17:00:00");
                            $end_time2 = strtotime($fulldate." ".$out_time);
                            if($end_time2>$start_time2){
                                $otdiff= round(abs($end_time2 - $start_time2) / 60,2);
                            }else{
                                $otdiff=0;
                            }
                        }
                        
                        
                    }else{
                        ### Check Holidays
                        $sqlholi="SELECT * FROM holidays WHERE hdate='$fulldate' and active='1'";
                        $exeholi=mysqli_query($connect, $sqlholi);
                        if(mysqli_num_rows($exeholi)>=1){
                            $rowholi=mysqli_fetch_array($exeholi);
                            /*Variable Set*/
                            $record=false;
                            $holiday="yes";
                            $in_time="";
                            $out_time="";
                            $working_hours="";
                            $working_type="";
                            $status=$rowholi['title'];
                            $late_pay="";
                            $ot_pay="";
                            $latediff=0;
                            $otdiff=0;
                            $laterate=0;
                            $leaverate=0;
                            /*Variable Set*/

                        }else{
                            ### Check Sunday
                            if($weekday=="Sunday"){
                                /*Variable Set*/
                                $record=false;
                                $holiday="sunday";
                                $in_time="";
                                $out_time="";
                                $working_hours="";
                                $working_type="";
                                $status="";
                                $late_pay="";
                                $ot_pay="";
                                $latediff=0;
                                $otdiff=0;
                                $laterate=0;
                                $leaverate=0;
                                /*Variable Set*/
                            }else{
                                ### Check Leaves
                                $sqlleav="SELECT * FROM leaves where userID='$_GET[info]' and DATE(dateleave)='$fulldate' and active='1'";
                                $exeleav=mysqli_query($connect, $sqlleav);
                                if(mysqli_num_rows($exeleav)>=1){
                                    $rowleav=mysqli_fetch_array($exeleav);
                                    $lea_id=$rowleav['id'];
                                    /*Variable Set*/
                                    $record=false;
                                    $holiday="per";
                                    $in_time="";
                                    $out_time="";
                                    $working_hours="";
                                    $working_type="";
                                    $status=$rowleav['Description'];
                                    $late_pay="";
                                    $ot_pay="";
                                    $latediff=0;
                                    $otdiff=0;
                                    $laterate=0;
                                    if($rowleav['paidleave']=="1"){
                                        $leaverate=0;
                                    }elseif($rowleav['paidleave']=="0"){
                                        /*For Deduction Purpose*/
                                        $leaverate=$basicSalary/$workingdays;;
                                    }
                                    /*Variable Set*/
                                }else{
                                    ### No Records found
                                    /*Variable Set*/
                                    $record=false;
                                    $holiday="norecord";
                                    $in_time="";
                                    $out_time="";
                                    $working_hours="";
                                    $working_type="";
                                    $status="No Record Entered";
                                    $late_pay="";
                                    $ot_pay="";
                                    $latediff=0;
                                    $otdiff=0;
                                    $laterate=0;
                                    $leaverate=0;
                                    /*Variable Set*/
                                }
                            }
                        }
                    }
                    ?>
                <tr class="<?php if($weekday=="Sunday"){ echo 'bg-sunday text-white'; } elseif($holiday=='yes') { echo 'bg-info text-white'; } elseif($holiday=='per') { echo 'bg-danger text-white'; }elseif($holiday=='norecord') { echo 'bg-white text-white display_none'; } ?>">
                    
                    <td><span><?php echo $formattedDate = date('d', strtotime($fulldate)); ?></span></td>
                    <td><span style="<?php if($weekday=='Sunday'){ echo 'background:red'; }elseif($weekday=='Saturday'){ echo 'background:blue'; }else{ echo ''; } ?>"><?php echo $weekday; ?></span></td>

                    <td>
                        <?php if($in_time!= '00:00:00'){
                            ?>
                            <span><?php echo date("h:i a",strtotime($in_time)); ?></span></td>
                            <?php
                        } ?>
                    <td>
                        <?php if($out_time!= '00:00:00'){
                            ?>
                            <span><?php echo date("h:i a",strtotime($out_time)); ?></span></td>
                            <?php
                        } else { ?>
                                                        

                                <form action="" method="post" style="width: 350px; margin-bottom: 20px;background: black;display: flow-root;padding: 5px;border-radius: 15px;">
                                    <input type="time" name="leaving_time" value="17:00" required style=" width: 110px; float: left; " class="form-control">
                                    <input type="submit" value="Save Leaving Time" name="save_leaving_time" class="btn btn-primary btn-rounded" style=" float: right; height: 36px; line-height: 0px; border-radius: 10px !important; font-size: 13px;">

                                    <input type="hidden" value="<?php echo $rowatt[id]; ?>" name="attendance_id">
                                    <input type="hidden" value="<?php echo $rowatt[att_date]; ?>" name="leaving_date">

                                    
                                    
                                </form>
                               </td>
                            <?php
                        } ?>
                    <td>
                        <?php if($record==true){
                            ?>
                            <span><?php echo date("H:i",strtotime($working_hours)); ?></span></td>
                            <?php
                        } ?>
                    <td>
                        <?php
                        if($record==true){
                            if($weekday!="Sunday"){
                            ?>
                            <span><?php echo $latediff." min"; ?></span>
                            <?php
                            }
                        }
                        ?>
                    </td>
                    
                    <td>
                        <?php
                        if($record==true){
                            if($weekday!="Sunday"){
                            ?>
                            <span class="badge badge-primary text-white"><?php echo $otdiff." min"; ?></span>
                            <?php
                            }
                        }
                        ?>
                    </td>
                    

                </tr>
                <?php

                $totallaterate+=$laterate;
                $totalotrate+=$otrate;
                $totalleaverate+=$leaverate;

            }
            ?>
        </tbody>
    </table>
    <?php
    }
    ?>
    <!-- ERP SALART SHEET -->
    
    
    
    
    <!-- ATTENDAnCE INFORMATION -->
    
    <form action="" method="post"align="center">
        <input type="" name="info" value="<?php echo $_GET['info']; ?>">
        <select name="selected_month" onchange="this.form.submit()" style="padding: 2px 25px;border-radius: 10px;background: =;display: initial;text-align: center;font-weight: 200;font-size: 12px;margin-bottom: 10px;border: none;">
           
            <?php
        for ($i = 0; $i < 12; $i++) {
            $month = date('M, Y', strtotime("first day of -$i month"));
            ?> 
            <option value="<?php echo $month; ?>" <?php if($month == $_SESSION['selected_month']){ echo "selected"; } ?>>
                Month: <?php echo $month; ?>
            </option> 
            <?php
        }
    ?>
        </select>
        <noscript><input type="submit" value="Submit"></noscript>
    </form>







    <?php
    if(!isset($_GET['info'])){

        $yearmonth=date("Y-m", strtotime("1st ".$_SESSION['selected_month']));
        $lastdate=date("t", strtotime($_SESSION['selected_month']));
        $today_fulldate=date("Y-m-d");

        ?>
        <div class="row" style="margin:0px">
            <div class="col-md-12 btn-warning btn" style=" line-height: 0px;  margin-bottom: 10px;">LEAVING NOT MARKED</div>
        <?php
        $sqlnotleave="SELECT *, COUNT(userID) as recordcount from attendance 
                    join (select id, name,profile_picture from users) usertbl
                    on attendance.userID=usertbl.id
                    where out_time='00:00:00' and active='1' and attendance.att_date like '$yearmonth%'
                    and attendance.att_date != '$today_fulldate' GROUP by attendance.userID";
        $exenotleave=mysqli_query($connect, $sqlnotleave);
        while($rownotleave=mysqli_fetch_array($exenotleave)){
            ?>
            <div class="col-md-4" style="margin-bottom:10px">
                <button class="form-control userrecord" id="<?php echo $rownotleave['userID']; ?>" style="height:auto !important;padding: 5px;font-size: smaller;">

                    <?php if($rownotleave[profile_picture] != '') { echo '<img src="images/profile_picture/'.$rownotleave[profile_picture].'" style="max-height:45px; max-width: 45px;     border-radius: 50%;  border:1px solid; filter: grayscale(0%); width:100% ">'; } else { echo '<img src="https://cdn.onlinewebfonts.com/svg/img_546302.png" style="max-height:45px; max-width: 45px; border-radius: 50%;  width:100% ">'; }  ?>

                    <?php echo $rownotleave['name']; ?> <span class="badge badge-warning"><?php echo $rownotleave['recordcount']; ?></span></button>
                <table class="table table-sm table-bordered userrecordtbl" id="userrecord<?php echo $rownotleave['userID']; ?>" style="font-size: small; display: none;">
                    <?php
                        $sqlnotleaverecord="SELECT * from attendance 
                                            join (select id, name,profile_picture from users) usertbl
                                            on attendance.userID=usertbl.id
                                            where out_time='00:00:00' and active='1' and attendance.userID='$rownotleave[userID]' and attendance.att_date like '$yearmonth%'";
                        $exenotleaverecord=mysqli_query($connect, $sqlnotleaverecord);
                        while($rownotleaverecord=mysqli_fetch_array($exenotleaverecord)){
                            ?>
                            <tr>
                                <td><?php echo $rownotleaverecord['att_date']; ?></td>
                                <td><?php echo $rownotleaverecord['in_time']; ?></td>
                            </tr>
                            <?php
                        }
                    ?>
                </table>
            </div>
            <?php
        }
        ?>
        </div>

        <hr>

        <div class="row" style="margin: 0px">
            <div class="col-md-12 btn-danger btn" style=" line-height: 0px; margin-bottom: 10px; ">ATTENDANCE NOT MARKED</div>
            <?php
         $sqluser="SELECT * FROM users where no_more!='Yes' and user_level!='5' and attendance_allowed != 1 order by user_level ";
            $exeuser=mysqli_query($connect, $sqluser);
            $usercount=mysqli_num_rows($exeuser);
            while($rowuser=mysqli_fetch_array($exeuser)){
                ?>
                <div class="col-md-4" style="margin-bottom:10px">
                    <button class="form-control userrecord" data-id="<?php echo $rowuser['id']; ?>" id="userlbl<?php echo $rowuser['id']; ?>" style="height:auto !important;padding: 5px;font-size: smaller;">

                    <?php if($rownotleave[profile_picture] != '') { echo '<img src="images/profile_picture/'.$rownotleave[profile_picture].'" style="max-height:45px; max-width: 45px;     border-radius: 50%;  border:1px solid; filter: grayscale(0%); width:100% ">'; } else { echo '<img src="https://cdn.onlinewebfonts.com/svg/img_546302.png" style="max-height:45px; max-width: 45px; border-radius: 50%;  width:100% ">'; }  ?>

                    <?php echo $rowuser['name']; ?></button>
                    <table class="table table-sm table-bordered userrecordxtbl" id="userrecordx<?php echo $rowuser['id']; ?>" style="font-size: small; display: none;">
                <?php
                $hidex=0;
                for($x=1; $x<=$lastdate; $x++){
                    $fulldate=$yearmonth."-".$x;
                    $weekday=date("l", strtotime($fulldate));
                    $record=true; 

                   $sqlatt="SELECT * FROM attendance where userID='$rowuser[id]' and att_date ='$fulldate' and active='1'";
                    $exeatt=mysqli_query($connect, $sqlatt);
                    if(mysqli_num_rows($exeatt)>=1){
                        
                        $record=true;
                    }else{
                        ### Check Holidays
                        $sqlholi="SELECT * FROM holidays WHERE hdate='$fulldate' and active='1'";
                        $exeholi=mysqli_query($connect, $sqlholi);
                        if(mysqli_num_rows($exeholi)>=1){
                            $record=true;
                            
                        }else{
                            if($weekday=="Sunday"){
                                $record=true;
                            }else{
                                ### Check Leaves
                                $sqlleav="SELECT * FROM leaves where userID='$rowuser[id]' and DATE(dateleave)='$fulldate' and active='1'";
                                $exeleav=mysqli_query($connect, $sqlleav);
                                if(mysqli_num_rows($exeleav)>=1){
                                    $record=true;
                                }else{
                                    $record=false;
                                }
                            }
                        }
                    }

                    if($record==false && strtotime($fulldate)<=time()){
                        
                         $hidex+=1;
                      
                        ?>
                        <tr>
                            <td><?php echo $fulldate; ?></td>
                        </tr>
                        <?php
                    }else {
                        
                         
                        
                        
                    }
                    
                    
                    
                    
                    

                }

                if($hidex==0){
                    ?>
                    <script>
                        $(document).ready(function(){
                            $("#userrecordx<?php echo $rowuser['id']; ?>").parent().css( "display", "none" );
                        });
                    </script>
                    <?php
                }else{
                    ?>
                    <script>
                        $(document).ready(function(){
                            $("#userlbl<?php echo $rowuser['id']; ?>").append( "<span class='badge badge-warning'><?php echo $hidex; ?></span>" );
                        });
                    </script>
                    <?php
                }
                ?>
                    </table>
                </div>
                <?php
            }
            ?>
        </div>
        <?php
    }
    ?>
    
    
    
    
    
    

    
    

</div>
</div>















<div class="col-md-3">
<div class="card" style="padding: 15px;">
    <?php
    if(isset($_GET['info']) && $_GET['info']!=""){
        ?>
        <div style="padding: 5px 10px; height: unset;">
            <?php
            if(isset($_GET['leavedone'])){
                ?>
                <div class="alert alert-success" role="alert" style="margin: 0px 0px 10px 0px;     line-height: 0px;">
                    Created!
                </div>
                <?php
            }
            if(isset($_GET['leavedone2'])){
                ?>
                <div class="alert alert-warning" role="alert" style="margin: 0px 0px 10px 0px;     line-height: 0px;">
                    Already Created!
                </div>
                <?php
            }
            ?>
            <form action="" method="post">
                <input type="hidden" name="userID" value="<?php echo $_GET['info']; ?>">
                <input type="date" value="<?php echo date('Y-m-d'); ?>" name="leavedate" required class="form-control form-control-sm">
                <input name="description" class="form-control form-control-sm" value="" required  style="margin-top:10px; width:100%">
                <input type="submit" class="btn btn-sm btn-warning" value="MARK LEAVE TO <?php echo $rowuser_selected_user[name]; ?>" name="leaving_submit" style="margin-top:10px; width:100%; text-transform: uppercase;">
            </form>
        </div>
        <?php
    }


    if(isset($_POST['leaving_submit'])){
        $userid=$_POST['userID'];
        $entered_by=$_SESSION['logSyscuruser'];

        $LeaveType="";
        $leavetypereason="";
        $starttime=date("H:i:s");
        $endtime=date("H:i:s");
        $ToDate=date("Y-m-d");
        $FromDate=date("Y-m-d");
        $Description=mysqli_real_escape_string($connect, $_POST['description']);
        $shortleavereason="";
        $halfdayreason="";
        $Priority="";
        $dateleave=$_POST['leavedate'];
        $diffdates='1';

        $code=time();
        $dateleave=date("Y-m-d H:i:s", strtotime($dateleave));
        $active='1';

        $leavestatus="";
        if($leavestatus=='0'){
            $Status='0';
        }else{
            $Status='1';
        }

        $sqlleavechk="SELECT * FROM leaves where userID='$userid' and dateleave='$dateleave' and active='1'";
        $exeleavechk=mysqli_query($connect, $sqlleavechk);
        if(mysqli_num_rows($exeleavechk)>=1){
            header("Location: attendance.php?info=$userid&leavedone2");
        }else{


            $sqlleave="INSERT INTO leaves VALUES (null, '$LeaveType', '$leavetypereason','$userid','$entered_by','$starttime','$endtime', '$ToDate', '$FromDate', '$diffdates','$Description','$shortleavereason', '$halfdayreason','$dateleave','$Status','$code', '$Priority', '1', '', '$active' )";
            $exeleave=mysqli_query($connect, $sqlleave);
            if($exeleave){


                                        $sql = "SELECT * FROM  users WHERE id = '$userid' ";
                                        $result = mysqli_query($connect, $sql);
                                        $prax = mysqli_fetch_array($result) ;
                                        $to = $prax[username];
                                        $marked_date_and_time=date("Y-m-d H:i:s");

                                        $text = "$prax[name]<br>Leave : $_POST[leavedate] <br>System Time : $marked_date_and_time<br>$_POST[description]";


                                        $output4 = preg_replace('!\s+!', ' ', $text);
                                        $baseurl ="https://www.textit.biz/sendmsg";

                                        $url = "$baseurl/?id=942021070701&pw=7470&to=$to&text=$output4&eco=Y";
                                        $ret = file($url);     $res= explode(":",$ret[0]);           
                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$url'></iframe>";

                                        $urlX = "$baseurl/?id=942021070701&pw=7470&to=0773966920&text=$output4&eco=Y"; 
                                        echo "<iframe style='height:1px; width:1px;display: none;' src='$urlX'></iframe>";

                                        $header_url_for_leave = 'attendance.php?info='.$userid.'&leavedone';
                                        echo '<meta http-equiv="refresh" content="3;url=' . $header_url_for_leave . '">';

            }
        }
    }
    ?>
</div>

</div>







              
              
              
<div style="width: 100%; height: 15px"></div>
    
<br>













            
                        
             
              
              
                        </div>
                    </div>
                </div>
                
                
                
                
                
                
                
                
                
                
                























                    <div class="">

                        <div class="col-md-12">
                            <div class="card">

                                <div class="card-body" style="padding:0px">
                                   

                                    <table class="table table-sm table-hover table-bordered" id="tableTh" style="display: block; overflow-x: scroll;">
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <?php

                                                if ($pra_user_user_level == '1' || $pra_user_user_level == '2') { 
                                                    $sqluser = "SELECT * FROM  users WHERE no_more != 'Yes' AND user_level != '5' order by user_level";
                                                } else { 
                                                    $sqluser = "SELECT * FROM  users WHERE no_more != 'Yes' AND user_level != '5' AND id = '$_SESSION[logSyscuruser]' order by user_level ";
                                                }

                                                $exeuser=mysqli_query($connect, $sqluser);
                                                $usercount=mysqli_num_rows($exeuser);
                                                while($rowuser=mysqli_fetch_array($exeuser)){


                                                $att_date_new=date("Y-m-d");
                                             
                                                $sql_check_attendance = "SELECT * FROM attendance where userID = '$rowuser[id]'  AND att_date = '$att_date_new' ";
                                                $result_check_attendance = mysqli_query($connect, $sql_check_attendance);
                                                $rowcount=mysqli_num_rows($result_check_attendance);


                                                    ?>
                                                    <th>
                                                        <a href="attendance.php?info=<?php echo $rowuser[id]; ?>" align="center" style="    display: block;">
                                                            <?php if($rowcount != '0') { echo '<img src="images/profile_picture/'.$rowuser[profile_picture].'" style="max-height:65px; max-width: 65px;     border-radius: 50%;  border:1px solid; filter: grayscale(0%); width:100% ">'; } else { echo '<img src="https://cdn.onlinewebfonts.com/svg/img_546302.png" style="max-height:65px; max-width: 65px; border-radius: 50%;  width:100% ">'; }  ?>

                                                            <!--<img src="images/profile_picture/<?php echo $rowuser[profile_picture]; ?>" style="width: 45px; height: 45px; border-radius: 50%; border:1px solid; margin-top: 10px;">-->
                                                            <br>

                                                            <span class="emp_name_new" style="padding: 2px 5px;border-radius: 5px; font-size: 8px; text-transform: uppercase; font-weight: 100;"><?php echo $rowuser[name]; ?></span>
                                                        </a>
                                                    </th>
                                                    <?php
                                                }
                                                ?>
                                                <?php if($pra_user_user_level == '1') { ?>
                                                    <th>Day Sal</th>
                                                    <th>Day Late</th>
                                                    <th>Day OT</th> 
                                                <?php } ?>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        
                                        <!--Saru update -->
                                        <tbody>
                                            <?php
                                            $sqluser="SELECT * FROM users where no_more!='Yes' and user_level!='5' order by user_level";
                                            $exeuser=mysqli_query($connect, $sqluser);
                                            $usercount=mysqli_num_rows($exeuser);
                                            while($rowuser=mysqli_fetch_array($exeuser)){
                                                 ${"varemp$rowuser[id]"} = $rowuser['name'];
                                                 ${"varempsal$rowuser[id]"} = 0;
                                            }
                                            
                                            $totalLateAmount=0;
                                            $totalOTAmount=0;
                                            $totalSalaryAmount=0;
                                            $totalNetAmount=0;
                                            
                                            $yearmonth=date("Y-m", strtotime("1st ".$_SESSION['selected_month']));
                                            echo$yearmonth;
                                        
                                            
                                            $lastdate=date("t", strtotime($_SESSION['selected_month']));
                                            
                                            echo $lastdate;
                                            $workingdays=0;
                                            for($w=1; $w<=$lastdate; $w++){
                                                $fulldate=$yearmonth."-".$w;
                                                if(date("l", strtotime($fulldate))!="Sunday"){
                                                    $workingdays+=1;
                                                }
                                            }
                                            for($w=1; $w<=$lastdate; $w++){
                                                $fulldate=$yearmonth."-".$w;
                                                if(date("l", strtotime($fulldate))!="Sunday"){
                                                    $sqlholiday="SELECT id FROM holidays WHERE hdate='$fulldate' and active='1'";
                                                    $exeholiday=mysqli_query($connect, $sqlholiday);
                                                    if(mysqli_num_rows($exeholiday)==1){
                                                        $workingdays-=1;
                                                    }
                                                }
                                            }
                                            $workingdays;

                                            $totallaterate=0;
                                            $totalotrate=0;
                                            $totalleaverate=0;

                                            $todaysal=0;

                                            for($x=1; $x<=$lastdate; $x++){
                                                    $fulldate=$yearmonth."-".$x;
                                                   $fulldate;
                                                    $weekday=date("l", strtotime($fulldate));
                                                ?>
                                                <tr>
                                                    <td id="A<?php echo $x; ?>" class="<?php if($weekday=="Sunday"){ echo 'bg-sunday'; } ?>"><span style="margin:10px; height:20px; display: block;"><?php
                                                            $timestamp = strtotime($fulldate);
                                                            $newFormat = date("d", $timestamp);
                                                            echo $newFormat;
                                                    ?></span></td>

                                                    <?php

                                                    $DaySalAll=0;
                                                    $DayLateAll=0;
                                                    $DayOTAll=0;
                                                    $DayNetAll=0;
                                                    $sqluser="SELECT * FROM users where no_more!='Yes' and user_level!='5' order by user_level";
                                                    $exeuser=mysqli_query($connect, $sqluser);
                                                    $usercount=mysqli_num_rows($exeuser);
                                                    while($rowuser=mysqli_fetch_array($exeuser)){
                                                         
                                                         

                                                        ?>
                                                        <?php 
                                                        $userID=$rowuser['id']; 
                                                        $basicSalary=$rowuser['online_payment'];
                                                        $workstarttime=$rowuser['work_start_time'];
                                                        /* Theesan Calculation */
                                                        
                                                        ### Check Attendance
                                                        $sqlatt="SELECT * FROM attendance where userID='$userID' and att_date ='$fulldate' and active='1'";
                                                 
                                                        $exeatt=mysqli_query($connect, $sqlatt);
                                                        if(mysqli_num_rows($exeatt)>=1){
                                                            $rowatt=mysqli_fetch_array($exeatt);
                                                            $att_id=$rowatt['id'];
                                                            /*Variable Set*/
                                                            $record=true;
                                                            $holiday="no";
                                                                 
                                                            $in_time=$rowatt['in_time'];
                                                            $out_time=$rowatt['out_time'];
                                                            $working_hours=$rowatt['working_hours'];
                                                            
                                                             $added_hours=$rowatt['note'];
                                                            $working_type=$rowatt['working_type'];
                                                            $status=$rowatt['late_reason'];
                                                            $late_pay=$rowatt['late_pay'];
                                                            $ot_pay=$rowatt['ot_pay'];
                                                            $leaverate=0;
                                                            /*Variable Set*/

                                                            // Late minutes
                                                            //$start_time = strtotime($fulldate." 08:30:00");
                                                            $start_time = strtotime($fulldate." ".$rowuser['zoom_first_name']);
                                                            $end_time = strtotime($fulldate." ".$in_time);
                                                            if($end_time>$start_time){
                                                                $latediff= round(abs($end_time - $start_time) / 60,2);
                                                            }else{
                                                                $latediff=0;
                                                            }

                                                            $worktime=round( (abs(strtotime($fulldate." ".$out_time)) - abs(strtotime($fulldate." ".$in_time))) /3600,2);

                                                            ### Check Holidays
                                                            $sqlholi="SELECT * FROM holidays WHERE hdate='$fulldate' and active='1'";
                                                            $exeholi=mysqli_query($connect, $sqlholi);
                                                            if(mysqli_num_rows($exeholi)>=1){
                                                                $holiday="yes";
                                                            }

                                                            if($weekday=="Sunday"){
                                                                $holiday="sunday";
                                                            }



                                                            // OT Minutes
                                                            if($weekday=="Saturday"){
                                                                //$start_time2 = strtotime($fulldate." 13:00:00");
                                                                $start_time2 = strtotime($fulldate." ".$rowuser['send_pin_code_automatically']);
                                                                $end_time2 = strtotime($fulldate." ".$out_time);
                                                                if($end_time2>$start_time2){
                                                                    $otdiff= round(abs($end_time2 - $start_time2) / 60,2);
                                                                }else{
                                                                    $otdiff=0;
                                                                }
                                                            }else{
                                                                //$start_time2 = strtotime($fulldate." 17:00:00");
                                                                //echo $fulldate." ".$rowuser['placeholder_to_input'];
                                                                $start_time2 = strtotime($fulldate." ".$rowuser['placeholder_to_input']);
                                                                $end_time2 = strtotime($fulldate." ".$out_time);
                                                                if($end_time2>$start_time2){
                                                                    $otdiff= round(abs($end_time2 - $start_time2) / 60,2);
                                                                }else{
                                                                    $otdiff=0;
                                                                }
                                                            }
                                                            
                                                            
                                                        }else{
                                                            ### Check Holidays
                                                            $sqlholi="SELECT * FROM holidays WHERE hdate='$fulldate' and active='1'";
                                                            $exeholi=mysqli_query($connect, $sqlholi);
                                                            if(mysqli_num_rows($exeholi)>=1){
                                                                $rowholi=mysqli_fetch_array($exeholi);
                                                                /*Variable Set*/
                                                                $record=false;$holiday="yes";$in_time="";$out_time="";$working_hours="";$working_type="";$status=$rowholi['title'];$late_pay="";$ot_pay="";$latediff=0;$otdiff=0;$laterate=0;$leaverate=0;
                                                                /*Variable Set*/

                                                            }else{
                                                                ### Check Sunday
                                                                if($weekday=="Sunday"){
                                                                    /*Variable Set*/
                                                                    $record=false;$holiday="sunday";$in_time="";$out_time="";$working_hours="";$working_type="";$status="";$late_pay="";$ot_pay="";$latediff=0;$otdiff=0;$laterate=0;$leaverate=0;
                                                                    /*Variable Set*/
                                                                }else{
                                                                    ### Check Leaves
                                                                    $sqlleav="SELECT * FROM leaves where userID='$userID' and DATE(dateleave)='$fulldate' and active='1'";
                                                                    $exeleav=mysqli_query($connect, $sqlleav);
                                                                    if(mysqli_num_rows($exeleav)>=1){
                                                                        $rowleav=mysqli_fetch_array($exeleav);
                                                                        $lea_id=$rowleav['id'];
                                                                        /*Variable Set*/
                                                                        $record=false;$holiday="per";$in_time="";$out_time="";$working_hours="";$working_type="";$status=$rowleav['Description'];$late_pay="";$ot_pay="";$latediff=0;$otdiff=0;$laterate=0;
                                                                        if($rowleav['paidleave']=="1"){
                                                                            $leaverate=0;
                                                                        }elseif($rowleav['paidleave']=="0"){
                                                                            /*For Deduction Purpose*/
                                                                            $leaverate=$basicSalary/$workingdays;;
                                                                        }
                                                                        /*Variable Set*/
                                                                    }else{
                                                                        ### No Records found
                                                                        /*Variable Set*/
                                                                        $record=false; $holiday="norecord"; $in_time=""; $out_time=""; $working_hours=""; $working_type=""; $status="No Record"; $late_pay=""; $ot_pay=""; $latediff=0; $otdiff=0; $laterate=0; $leaverate=0;
                                                                        /*Variable Set*/
                                                                    }
                                                                }
                                                            }
                                                        }


                                                        ### LATE Calculation
                                                        $laterate=0;
                                                        if($record==true){
                                                            if($late_pay=="1"){
                                                                if($weekday=="Saturday"){
                                                                    ### Code to convert into minutes
                                                                    date("Y-m-d H:i:s", strtotime($fulldate." ".$rowuser['send_pin_code_automatically']));
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['send_pin_code_automatically']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $laterate=($basicSalary/($workingdays*$timeDiffMinutes))*$latediff;
                                                                }elseif($weekday=="Sunday"){
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $laterate=($basicSalary/($workingdays*$timeDiffMinutes))*$latediff;
                                                                }else{
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $laterate=($basicSalary/($workingdays*$timeDiffMinutes))*$latediff;
                                                                }
                                                            }else{
                                                                $laterate=0;
                                                            }

                                                            if($latediff>=1){
                                                                ?>
                                                                <!-- <span class="badge badge late<?php echo $att_id; ?><?php echo $user; ?>"><?php if($late_pay=="1"){ echo number_format($laterate, 2); } ?></span>
                                                                <input type="hidden" class="fulldate<?php echo $att_id; ?><?php echo $user; ?>" value="<?php echo $fulldate; ?>"> -->
                                                                <?php
                                                                if($late_pay=="1"){
                                                                    if($weekday!="Sunday"){
                                                                    ?>
                                                                    <!-- <button type="button" class="btn btn-danger btn-sm chklateoff chklate<?php echo $att_id; ?><?php echo $user; ?>" id="<?php echo $att_id; ?>" data-id="<?php echo $user; ?>" >x</button> -->
                                                                    <?php
                                                                    }
                                                                }else{
                                                                    if($weekday!="Sunday"){
                                                                    ?>
                                                                    <!-- <button type="button" class="btn btn-success btn-sm chklateon chklate<?php echo $att_id; ?><?php echo $user; ?>" id="<?php echo $att_id; ?>" data-id="<?php echo $user; ?>" >+</button> -->
                                                                    <?php
                                                                    }
                                                                }
                                                            }
                                                        }




                                                        ### OT Calculation
                                                        $otrate=0;
                                                        if($record==true){
                                                            if($ot_pay=="1"){
                                                                if($weekday=="Saturday"){
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['send_pin_code_automatically']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $otrate=($basicSalary/($workingdays*$timeDiffMinutes))*$otdiff;
                                                                }elseif($weekday=="Sunday"){
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $otrate=($basicSalary/($workingdays*$timeDiffMinutes))*$otdiff;
                                                                }else{
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $otrate=($basicSalary/($workingdays*$timeDiffMinutes))*$otdiff;
                                                                }
                                                            }else{
                                                                $otrate=0;
                                                            }

                                                            if($otdiff>=1){
                                                                ?>
                                                                <!-- <span class="badge badge ot<?php echo $att_id; ?><?php echo $user; ?>"><?php if($ot_pay=="1"){ echo number_format($otrate, 2); } ?></span>
                                                                <input type="hidden" class="fulldate<?php echo $att_id; ?><?php echo $user; ?>" value="<?php echo $fulldate; ?>"> -->
                                                                <?php
                                                                if($ot_pay=="1"){
                                                                    if($weekday!="Sunday"){
                                                                    ?>
                                                                    <!-- <button type="button" class="btn btn-danger btn-sm chkotoff chkot<?php echo $att_id; ?><?php echo $user; ?>" id="<?php echo $att_id; ?>" data-id="<?php echo $user; ?>" >x</button> -->
                                                                    <?php
                                                                    }
                                                                }else{
                                                                    if($weekday!="Sunday"){
                                                                    ?>
                                                                    <!-- <button type="button" class="btn btn-success btn-sm chkoton chkot<?php echo $att_id; ?><?php echo $user; ?>" id="<?php echo $att_id; ?>" data-id="<?php echo $user; ?>" >+</button> -->
                                                                    <?php
                                                                    }
                                                                }
                                                            }
                                                        }elseif($holiday=="per"){
                                                            if($rowleav['paidleave']=="1"){
                                                                ?>
                                                                <!-- <input type="button" class="btn btn-sm text-danger nopay leavepay<?php echo $rowleav['id']; ?><?php echo $user; ?>" id="<?php echo $user; ?>" data-id="<?php echo $rowleav['id']; ?>" value="No Pay"> -->
                                                                <?php
                                                            }else{
                                                                ?>
                                                                <!-- <input type="button" class="btn btn-sm text-primary yespay leavepay<?php echo $rowleav['id']; ?><?php echo $user; ?>" id="<?php echo $user; ?>" data-id="<?php echo $rowleav['id']; ?>" value="Pay"> -->
                                                                <?php
                                                            }
                                                        }




                                                        ########
                                                        $currentdiff=0;
                                                        $currentrate=0;
                                                        
                                                        ### Current Working Time
                                                        if(strtotime($fulldate)==strtotime(date("Y-m-d"))){
                                                            if(strtotime($fulldate." ".$in_time)>strtotime($fulldate." ".$rowuser['zoom_first_name'])){
                                                                $starttime3 = strtotime($fulldate." ".$in_time);
                                                            }else{
                                                                $starttime3 = strtotime($fulldate." ".$rowuser['zoom_first_name']);
                                                            }

                                                            if($out_time=="00:00:00"){
                                                                $nowtime=strtotime(date("Y-m-d H:i:s"));

                                                                if($nowtime>$starttime3){
                                                                    $currentdiff = round(abs($nowtime - $starttime3) / 60,2);
                                                                    if($weekday=="Saturday"){
                                                                        $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['send_pin_code_automatically']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                        $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                    }elseif($weekday=="Sunday"){
                                                                        $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                        $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                    }else{
                                                                        $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                        $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                    }
                                                                }
                                                            }else{
                                                                $nowtime=strtotime($fulldate." ".$out_time);

                                                                if($nowtime>$starttime3){
                                                                    $currentdiff = round(abs($nowtime - $starttime3) / 60,2);
                                                                    if($weekday=="Saturday"){
                                                                        $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['send_pin_code_automatically']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                        $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                    }elseif($weekday=="Sunday"){
                                                                        $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                        $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                    }else{
                                                                        $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                        $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                    }
                                                                }
                                                            }
                                                        }else{
                                                            if(strtotime($fulldate." ".$in_time)>strtotime($fulldate." ".$rowuser['zoom_first_name'])){
                                                                $starttime3 = strtotime($fulldate." ".$in_time);
                                                            }else{
                                                                $starttime3 = strtotime($fulldate." ".$rowuser['zoom_first_name']);
                                                            }

                                                            $nowtime=strtotime($fulldate." ".$out_time);
                                                            
                                                            if($nowtime>$starttime3){
                                                                //echo $rowuser['name'];
                                                                $currentdiff = round(abs($nowtime - $starttime3) / 60,2);
                                                                if($weekday=="Saturday"){
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['send_pin_code_automatically']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                }elseif($weekday=="Sunday"){
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff;
                                                                }else{
                                                                    $timeDiffMinutes = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60;
                                                                    // echo 'Salary :'; 
                                                                     $currentrate=($basicSalary/($workingdays*$timeDiffMinutes))*$currentdiff; 
                                                                    // echo '<br>';


                                                                    // echo 'Basic Salary : '; echo $basicSalary;echo '<br>';
                                                                    // echo 'Working Days : '; echo $workingdays;echo '<br>';
                                                                    // echo 'Time Difference in Minutes : '; echo $timeDiffMinutes;echo '<br>';
                                                                    // echo 'Current Difference : '; echo $currentdiff; echo '<br>';
                                                                    // echo '<br><br>';
                                                                }
                                                            }
                                                        }

                                                        

                                                        if($record==true){
                                                            if($holiday=="yes"){
                                                                $daysal=(($basicSalary/$workingdays)+$otrate-$laterate);
                                                            }elseif($holiday=="sunday"){
                                                                $timeDiffMinutes2 = (strtotime($fulldate." ".$rowuser['placeholder_to_input']) - strtotime($fulldate." ".$rowuser['zoom_first_name'])) / 60 /60;
                                                                $daysal=((($basicSalary/$workingdays)/$timeDiffMinutes2)*$worktime);
                                                                //$daysal=(($basicSalary/$workingdays)+$otrate-$laterate);
                                                            }else{
                                                                $daysal=($basicSalary/$workingdays)+$otrate-$laterate;
                                                            }
                                                        }elseif($holiday=="per"){
                                                            if($rowleav['paidleave']=="1"){
                                                                $daysal=($basicSalary/$workingdays);
                                                                ?>
                                                                <!-- <input type="number" style="text-align: right; width: auto; width: 110px;" class="form-control form-control-sm float-right" disabled id="daysalt<?php echo $rowleav['id']; ?><?php echo $user; ?>" value="<?php echo number_format($daysal,2,".",""); ?>"> -->
                                                                <?php
                                                            }elseif($rowleav['paidleave']=="0"){
                                                                ?>
                                                                <!-- <input type="number" style="text-align: right; width: auto; width: 110px;" class="form-control form-control-sm float-right" disabled id="daysalt<?php echo $rowleav['id']; ?><?php echo $user; ?>" value="<?php echo number_format(0,2,".",""); ?>"> -->
                                                                <!-- <span class="badge">No Payment</span> -->
                                                                <?php
                                                            }
                                                        }
                                                        ?>
                                                        <!-- =========================================================================== -->
                                                        <td id="<?php echo $userID; ?>-<?php echo $x; ?>" data-id="<?php echo $userID; ?>" class="colhigh col<?php echo $userID; ?> <?php if($weekday=="Sunday"){ echo 'bg-sunday text-white2'; } elseif($holiday=='yes') { echo 'bg-info text-white2'; } elseif($holiday=='per') { echo 'text-white2'; }elseif($holiday=='norecord') { echo 'bg-darknew text-white2'; } ?>" align="center" style="text-align: left; ">
                                                            <?php
                                                            if($record==true){

                                                                $total_minutes = 0;
                                                                if ($in_time > $rowuser['zoom_first_name']) {
                                                                    $attended_time = date_create($in_time);
                                                                    $office_time_start = date_create($rowuser['zoom_first_name']);
                                                                    $difference = date_diff($attended_time, $office_time_start);
                                                                    
                                                                    $hours_in_minutes = $difference->h * 60; // Convert hours to minutes
                                                                    $total_minutes = $hours_in_minutes + $difference->i; // Add hours and minutes 

                                                                    if ($total_minutes > 0) { 
                                                                        if ($total_minutes >= 180 ) { 
                                                                            $bg_color = '#333639';
                                                                        } elseif ($total_minutes >= 120) {
                                                                            $bg_color = '#505357';
                                                                        } elseif ($total_minutes >= 60) {
                                                                            $bg_color = '#64686c';
                                                                        } elseif ($total_minutes >= 30) {
                                                                            $bg_color = '#7f8387';
                                                                        }else{
                                                                            $bg_color = '#adb3b8';
                                                                        }
                                                                    } else {
                                                                        $bg_color = '#ffffff; color: #000 !important';
                                                                    }

                                                                } else {    $bg_color = '#ffffff; color: #000 !important';   }



                                                                ?>
                                                                <span class="badge text-white" style="background-color: <?php echo $bg_color; ?>;     line-height: 14px;"><?php echo date("H:i",strtotime($in_time)); ?>
                                                                <?php 
                                                                if($out_time!="00:00:00"){ 
                                                                    //echo "✅"; 
                                                                }else{
                                                                    if($weekday=="Saturday"){
                                                                        if(time()>strtotime($fulldate." ".$rowuser['send_pin_code_automatically'])){
                                                                            echo "<span style=' font-size: 15px; '>⚠️</span>";
                                                                        }
                                                                    }elseif($weekday=="Sunday"){
                                                                        if(time()>strtotime($fulldate." ".$rowuser['placeholder_to_input'])){
                                                                            echo "<span style=' font-size: 15px; '>⚠️</span>";
                                                                        }
                                                                    }else{
                                                                        if(time()>strtotime($fulldate." ".$rowuser['placeholder_to_input'])){
                                                                            echo "<span style=' font-size: 15px; '>⚠️</span>";
                                                                        }
                                                                    }
                                                                    
                                                                }
                                                                ?>
                                                                </span>
                                                                <span style="display: none"> <?php echo date("H:i",strtotime($in_time)); ?></span>
                                                                <!-- <span class="badge badge-success"><?php echo date("H:i",strtotime($working_hours)); ?></span> -->
                                                                <?php
                                                                if($weekday!="Sunday"){
                                                                ?>
                                                                <!-- <span class="badge badge-warning text-white"><?php echo $latediff." min"; ?></span>
                                                                <span class="badge badge-primary text-white"><?php echo $otdiff." min"; ?></span> -->
                                                                <?php
                                                                }

                                                                //echo "<br>";
                                                                 
                                                                 
                                                                 ?>
<span class="badge" style="font-weight: 500;line-height: initial;text-align: left; display:none; <?php if($pra_user_user_level == '1') { echo 'display:unset;'; } ?>" >
    <br>
    
  

     
      <span>ID : <?php echo $att_id; ?></span><br>
     
    <span>In time : <?php echo $in_time; ?></span><br>
    <span>Off time : <?php echo $out_time; ?></span><br>
    <span>Working : <?php echo $working_hours; ?></span><br>
    <span>Added hours: <?php echo $added_hours; ?></span><br>
    <span>
                <div class="popup" id="popupForm" style="display: none;">
<form method="POST" action="">
    <label>ID:</label><br>
    <input type="text" name="att_id" id="popup_att_id" readonly><br><br>

    <label>In time:</label><br>
    <input type="time" name="in_time" id="popup_in_time" onchange="calculateWorkingHours()"><br><br>

    <label>Off time:</label><br>
    <input type="time" name="out_time" id="popup_out_time" onchange="calculateWorkingHours()"><br><br>

    <label>Working hours:</label><br>
    <input type="text" name="working_hours" id="popup_working_hours" readonly><br><br>

    <label>Added hours:</label><br>
    <input type="text" name="added_hours" id="popup_added_hours"><br><br>

    <button type="submit" name="att_saru" style="background-color: green; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
        Save
    </button>
    <button type="button" id="closeButton" onclick="closePopup()" style="background-color: gray; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
        Cancel
    </button>
</form>
</div>
    </span>
    
    <span>
            <span>
    <button onclick="openPopup(
        '<?php echo $att_id; ?>',
        '<?php echo $in_time; ?>',
        '<?php echo $out_time; ?>',
        '<?php echo $working_hours; ?>',
        '<?php echo $added_hours; ?>'
    )">Edit</button>
</span>

    </div>
</span>

<span>
   

</span>
  

    <!-- Popup Form -->

<?php if($laterate != '0'){?>
    <span style="color:red">Late : <?php echo number_format($laterate,2); ?></span><br><br>
<?php } ?>

<span>Day : <?php echo number_format(($basicSalary / $workingdays), 2); ?></span><br>

<?php
if ($weekday == "Saturday") {
    $thresholdHours = 4.5;
} else {
    $thresholdHours = 8.5;
}

// Set start limit - use $workstarttime if not empty, otherwise default to 08:30
$defaultStart = strtotime('08:30:00');
$workStart = !empty($workstarttime) ? strtotime($workstarttime) : $defaultStart;
$startLimit = $workStart; // This is the official start time

$inTime = strtotime($in_time);
$outTime = strtotime($out_time);
$addedHours = floatval($added_hours);

// Adjust inTime - if employee came early, use workStart time
$adjustedInTime = ($inTime < $workStart) ? $workStart : $inTime;

// Calculate max out time based on start limit and threshold hours
$maxOutTime = $workStart + ($thresholdHours * 3600);

// Cap out time
$actualOutTime = ($outTime > $maxOutTime) ? $maxOutTime : $outTime;

// Calculate worked hours using adjusted in time
$workedHours = ($actualOutTime - $adjustedInTime) / 3600;

// Hourly rate
$hourlyRate = ($basicSalary / $workingdays) / $thresholdHours;

// Default earning
$earning = 0;

if ($adjustedInTime <= $workStart) {
    if ($workedHours >= $thresholdHours) {
        $earning = $basicSalary / $workingdays;
    } else {
        $earning = $workedHours * $hourlyRate;
    }
} else {
    $earning = $workedHours * $hourlyRate;
}

// Add extra hours if any
if ($addedHours > 0) {
    $earning += $addedHours * $hourlyRate;
}

// Cap max earning to one full day
$maxEarning = $basicSalary / $workingdays;
if ($earning > $maxEarning) {
    $earning = $maxEarning;
}
?>

<span>Earning : <?php echo number_format($earning, 2); ?></span>
    
<!-- Trigger Button -->

   
<script>
    // Open popup function
    function openPopup(attId, inTime, outTime, workingHours, addedHours) {
        document.getElementById('popup_att_id').value = attId;
        document.getElementById('popup_in_time').value = inTime;
        document.getElementById('popup_out_time').value = outTime;
        document.getElementById('popup_working_hours').value = workingHours;
        document.getElementById('popup_added_hours').value = addedHours;

        document.getElementById('popupForm').style.display = 'block';
    }

    // Close popup function
    function closePopup() {
        document.getElementById('popupForm').style.display = 'none';
    }

    // Calculate working hours
    function calculateWorkingHours() {
        const inTime = document.getElementById('popup_in_time').value;
        const outTime = document.getElementById('popup_out_time').value;

        if (inTime && outTime) {
            const [inHours, inMinutes] = inTime.split(':').map(Number);
            const [outHours, outMinutes] = outTime.split(':').map(Number);

            const inDate = new Date(0, 0, 0, inHours, inMinutes);
            const outDate = new Date(0, 0, 0, outHours, outMinutes);

            let diff = (outDate - inDate) / 1000 / 60; // Difference in minutes

            if (diff < 0) {
                diff += 24 * 60; // Adjust for cases where outTime is past midnight
            }

            const hours = Math.floor(diff / 60);
            const minutes = diff % 60;

            document.getElementById('popup_working_hours').value = `${hours}h ${minutes}m`;
        } else {
            document.getElementById('popup_working_hours').value = '';
        }
    }
</script>

<script>


</script>
    <style>
        /* Style for the popup form */
        .popup {
            display: none; /* Initially hidden */
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            border: 1px solid #ccc;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            z-index: 1001; /* Make sure the popup is above everything */
        }

        /* Style for overlay background */
        .overlay {
            display: none; /* Initially hidden */
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000; /* Behind the popup */
        }

        /* Style for the button */
        button {
            background-color: red;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
        }
    </style>


<!-- Overlay -->

</span>
</span>






                                                                 <?php
                                                                 
                                                                //echo number_format($otrate,2)."<br>";
                                                                
                                                                $DaySalAll=$DaySalAll+($basicSalary/$workingdays);
                                                                $DayLateAll=$DayLateAll+$laterate;
                                                                $DayOTAll=$DayOTAll+$otrate;
                                                                //$DayNetAll=$DaySalAll+$DayOTAll-$DayLateAll;
                                                                $DayNetAll=$DayNetAll+$earning;
                                                                
                                                                
                                                                
                                                                
                                                                //${"varemp$rowuser[id]"} = $rowuser['name'];
                                                                ${"varempsal$rowuser[id]"} = ${"varempsal$rowuser[id]"}+$earning;
    

                                                            }else{
                                                                if($status=="No Record" && strtotime($fulldate)<=time()){
                                                                    ?>
                                                                    <span style="padding: 0px; font-size: x-large; border-radius: 5px;">⚠️</span>
                                                                    <?php
                                                                }elseif($holiday=="per"){
                                                                    ?>
                                                                    <span class="badge badge-danger" style="background: #f02e2e;">LEAVE</span>
                                                                    <?php
                                                                }
                                                            }
                                                            ?>

                                                        </td>
                                                        <?php

                                                    }
                                                    
                                                                $totalLateAmount+=$DayLateAll;
                                                                $totalOTAmount+=$DayOTAll;
                                                                $totalSalaryAmount+=$DaySalAll;
                                                                $totalNetAmount+=$DayNetAll;
                                                    ?>
                                                        
                                                        <?php if($pra_user_user_level == '1') {  ?>
                                                        <td style="text-align: right;"><!-- Dal Sal -->
                                                            <?php if($DaySalAll != '') { ?><span class="badge badge-primary"><?php echo number_format($DaySalAll, 2); ?></span><?php } ?>
                                                        </td>
                                                        <td style="text-align: right;"><!-- Dal Late -->
                                                            <?php if($DayLateAll != '') { ?><span class="badge badge-danger"><?php echo number_format($DayLateAll, 2); ?></span><?php } ?>
                                                        </td>
                                                        <td style="text-align: right;"><!-- Dal OT -->
                                                            <?php if($DayOTAll != '') { ?><span class="badge badge-green"><?php echo number_format($DayOTAll, 2); ?></span><?php } ?>
                                                        </td>
                                                        <?php } ?>
                                                        <td style="text-align: right;"><!-- Dal Net -->
                                                            <?php if($DayNetAll != '') { ?><span class="badge badge-warning"><?php echo number_format($DayNetAll, 2); ?></span><?php } ?>
                                                        </td>
                                                </tr>
                                                <?php
                                            }
                                            ?>
                                        </tbody>
                                    </table>



                                    <table class="table table-sm table-bordered">
                                        <?php
                                            $sqluser="SELECT * FROM users where no_more!='Yes' and user_level!='5' order by user_level";
                                            $exeuser=mysqli_query($connect, $sqluser);
                                            $usercount=mysqli_num_rows($exeuser);
                                            ?>
                                            <tr>
                                            <?php
                                            while($rowuser=mysqli_fetch_array($exeuser)){
                                                ?>
                                                
                                                <td>
                                                    
                                                     <?php echo $rowuser[id] ?><br>
                                                    
                                                    <?php echo ${"varemp$rowuser[id]"}; ?><br>
                                                    <?php echo number_format(${"varempsal$rowuser[id]"},2); ?>
                                                </td>
                                                <?php
                                            }
                                            ?>
                                            
                                            <td><?php echo number_format($ttotalSalaryAmount, 2); ?></td>
                                            <td><?php echo number_format($ttotalLateAmount, 2); ?></td>
                                            <td><?php echo number_format($totalOTAmount, 2); ?></td>
                                            <td><?php echo number_format($ttotalNetAmount, 2); ?></td>
                                            </tr>
                                    </table>
                                    
                                </div>
                                
                                
                                
                               





                            </div>
                        </div>

                    </div>
                
                
                
                
                






















                
                
                </div>
            </div>
        <!--**********************************
            Content body end
            ***********************************-->

        <!--**********************************
            Footer start
            ***********************************-->
            <div class="footer">
                <div class="copyright">
                    <p>Developed by <a href="https://cfms.lk/" target="_blank">Director</a></p>
                </div>
            </div>
        <!--**********************************
            Footer end
            ***********************************-->

    <!--**********************************
           Support ticket button start
           ***********************************-->

        <!--**********************************
           Support ticket button end
           ***********************************-->


       </div>
    <!--**********************************
        Main wrapper end
        ***********************************-->

    <!--**********************************
        Scripts
        ***********************************-->
        <!-- Required vendors -->
        <script src="./vendor/global/global.min.js"></script>
        <script src="./js/custom.min.js"></script>
        <script src="./js/deznav-init.js"></script>

        <script>
    "use strict"
    $(document).ready(function() {
        $('#dataTables-example2').DataTable({
            "pageLength": 50
        });
    });

</script>









  </body>
  
  
  
  
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js" defer></script>
<script src="js/camera/instascan.min.js" defer></script>

    <script>
        $(document).ready(function(){
            $(".colhigh").on("mouseover", function(){
                var txt=$(this).attr("data-id");
                $(".col"+txt).css("background-color", "#99a5af");
            });

            $(".colhigh").on("mouseout", function(){
                var txt=$(this).attr("data-id");
                $(".col"+txt).css("background-color", "unset");
            });
        });


        $(document).ready(function(){
            $(".userrecord").on("click", function(){
                var userID=$(this).attr("id");
                $(".userrecordtbl").hide();
                $("#userrecord"+userID).show();
            });

            $(".userrecordx").on("click", function(){
                var userID=$(this).attr("data-id");
                $(".userrecordxtbl").hide();
                $("#userrecordx"+userID).show();
            });
        });
    </script>


  </html>



  <?php ob_end_flush(); ?>