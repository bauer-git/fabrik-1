<?php
/**
 * Cascading drop down front end select layout
 */
defined('JPATH_BASE') or die;

$d = $displayData;
//var_dump($d);
?>
<div class="<?php echo $d->opts['elname'];?>___description">
	<?php echo $d->opts['description']; ?>
</div>
