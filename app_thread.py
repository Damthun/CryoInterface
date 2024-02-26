"""
Module for the AppThread class.
"""

from datetime import datetime
import logging
import os
import queue
import socket
from threading import Thread
import time
from typing import List, Optional
import re
import serial

from config import Config
from metadata import Metadata
from vna_funcs import ping_vna, vna_csv, vna_s2p


class AppThread(Thread):
    """
    Thread for running data logging activities concurrently with the web server.
    """

    def __init__(self):
        print('Application Started! Visit "Localhost:4951" via your browser to use the Interface.')
        super().__init__()

        # Application metadata.
        self.metadata: Optional[Metadata] = None

        # Application runtime configuration. (in seconds)
        self.config: Config = Config(period=15*60)

        # Whether an experiment has been selected.
        self.experiment_selected = False

        # Regardless of whether the experiment is running.
        self.running = False

        self.data_collection = False

        # Serial connection to microcontroller.
        self.con: Optional[serial.Serial] = None

        # VNA socket connections.
        self.vna_con1: Optional[socket.socket] = None
        self.vna_con2: Optional[socket.socket] = None

        # Variables to store VNA type, Will Help with SCPI
        self.vna_type1: Optional[str] = None
        self.vna_type2: Optional[str] = None
        # Temperature data collected by the experiment. Appended with each sampling.
        self.data = []

        # Collection of queues used for data streaming.
        self.queue_pool: List[queue.Queue] = []

        # Directory to store data in.
        self.dir: Optional[str] = None

        # Regardless of whether the application has been killed.
        self.killed = False
        self.possible_temps: Optional[list] = None
        self.known_devices: Optional[dict] = {}

    def run(self):
        """
        Function that is run when the thread is started.
        """
        # Run forever as long as the thread has not been killed.
        while not self.killed:
            last_reading = 0
            # If the experiment is running.
            if self.running and self.data_collection:
                # List of auxiliary sensor descriptors.
                self.possible_temps = [self.metadata.temp1, self.metadata.temp2,
                                       self.metadata.temp3, self.metadata.temp4]
                path = os.path.join('experiments', self.dir, 'temperatures.csv')
                # Open the file for saving temperature data, a+ for writing and updating.
                with open(path, 'a+', encoding='utf-8') as wf:
                    # We loop here so check again if the experiment is running and the
                    # application is alive.
                    while self.running and not self.killed:
                        # Whether we need to try again at taking data due to an error.
                        retry = False
                        # Get the current time.
                        t = time.time()

                        # If we have a USB connection; Auxiliary sensor data gathering.
                        if self.con:
                            try:
                                # Use function to grab dictionary containing selected temps.
                                readings = self._read_sensor_data(self.metadata.logger)

                                # Write Time information to file.
                                wf.write(f'{t}')
                                # For each auxiliary data, write to file.
                                for key in readings:
                                    wf.write(f',{readings[key]}')
                                # Write newline to separate readings.
                                wf.write(f'\n')
                                # Flush the write buffer.
                                wf.flush()

                                readings['time'] = t

                                # Store data points in memory.
                                self.data.append(readings)
                                # Write to the CSV file.

                                # Keep last reading, functions much like tic, toc.
                                last_reading = t

                                # Send data to every queue in the pool.
                                for q in self.queue_pool:
                                    q.put(readings)

                            except serial.serialutil.SerialException:
                                msg = 'Encountered an error while communicating with the ESP32.' \
                                      'Closing connection.'
                                logging.exception(msg)
                                try:
                                    self.con.close()
                                except:
                                    logging.exception('Error closing connection.')
                                self.con = None
                            except:
                                logging.exception('Exception encountered in app thread.')

                        # If we are connected to VNA 1; VNA 1 data gathering loop.
                        if self.vna_con1:
                            print('VNA1')
                            try:
                                dt = datetime.fromtimestamp(t)
                                name = f"{dt.year}_{dt.month:02d}_{dt.day:02d}_{dt.hour:02d}_{dt.minute:02d}_{dt.second:02d}"

                                f_name = f"{name}_{self.metadata.vna1_type}_vna1.csv"
                                fpath = os.path.join('experiments', self.dir, f_name)

                                result = vna_csv(self.vna_con1, fpath, self.known_devices[self.metadata.vna1_type])
                                if not result:
                                    retry = True
                                    continue

                                f_name = f"{name}_{self.metadata.vna1_type}_vna1.s2p"
                                fpath = os.path.join('experiments', self.dir, f_name)
                                result = vna_s2p(self.vna_con1, fpath, self.known_devices[self.metadata.vna1_type])
                                if not result:
                                    retry = True
                                    continue

                            except:
                                logging.exception('Error.')
                                try:
                                    self.vna_con1.close()
                                except:
                                    logging.exception('Error closing connection.')
                                self.vna_con1 = None

                        # If we are connected to VNA 2; VNA 2 data gathering loop.
                        if self.vna_con2:
                            print('VNA2')
                            try:

                                dt = datetime.fromtimestamp(t)

                                name = f"{dt.year}_{dt.month:02d}_{dt.day:02d}_{dt.hour:02d}_{dt.minute:02d}_{dt.second:02d}"

                                f_name = f"{name}_{self.metadata.vna2_type}_vna2.csv"
                                fpath = os.path.join('experiments', self.dir, f_name)

                                result = vna_csv(self.vna_con2, fpath, self.known_devices[self.metadata.vna2_type])
                                if not result:
                                    retry = True
                                    continue

                                f_name = f"{name}_{self.metadata.vna2_type}_vna2.s2p"
                                fpath = os.path.join('experiments', self.dir, f_name)
                                result = vna_s2p(self.vna_con2, fpath, self.known_devices[self.metadata.vna2_type])
                                if not result:
                                    retry = True
                                    continue
                            except:
                                logging.exception('Error.')
                                try:
                                    self.vna_con2.close()
                                except:
                                    logging.exception('Error closing connection.')
                                self.vna_con2 = None

                        if not retry:
                            # Sleep until it's time to collect the next data point.
                            start_time = t
                            while self.running and not self.killed and time.time() < start_time + self.config.period:
                                t = time.time()
                                if self.con and t >= last_reading + 15:

                                    try:
                                        readings = self._read_sensor_data(self.metadata.logger)
                                        readings['time'] = t



                                        # Store data points in memory.
                                        self.data.append(readings)

                                        # Send data to every queue in the pool.
                                        for q in self.queue_pool:
                                            q.put(readings)

                                    except serial.serialutil.SerialException:
                                        msg = 'Encountered an error while communicating with the ESP32.' \
                                            'Closing connection.'
                                        logging.exception(msg)
                                        try:
                                            self.con.close()
                                        except:
                                            logging.exception('Error closing connection.')
                                        self.con = None
                                    except:
                                        logging.exception('Exception encountered in app thread.')

                                    if self.vna_con1:
                                        # Ping VNA 1 to see if it's still connected.
                                        if not ping_vna(self.vna_con1):
                                            self.vna_con1 = None

                                    if self.vna_con2:
                                        # Ping VNA 2 to see if it's still connected.
                                        if not ping_vna(self.vna_con2):
                                            self.vna_con2 = None

                                    last_reading = t

                                # Sleep to avoid wasting CPU resources.
                                time.sleep(0.001)

            while not self.running and not self.killed:
                t = time.time()
                if self.con and t >= last_reading + 15:
                    if self.vna_con1:
                        # Ping VNA 1 to see if it's still connected.
                        if not ping_vna(self.vna_con1):
                            self.vna_con1 = None

                    if self.vna_con2:
                        # Ping VNA 2 to see if it's still connected.
                        if not ping_vna(self.vna_con2):
                            self.vna_con2 = None

                    last_reading = t
                # Sleep to avoid wasting CPU resources.
                time.sleep(0.001)

    def get_queue(self) -> queue.Queue:
        """
        Get a new queue for the data stream.

        :return: A queue containing all data up to this point.
        """
        # Create a new queue.
        q = queue.Queue()

        # Add previous data to the queue.
        for item in self.data:
            q.put(item)

        # Add the queue to the queue pool.
        self.queue_pool.append(q)

        return q

    def stop(self):
        """
        Stop the thread.
        """
        print('Stopped the Thread')
        self.killed = True
        # Close all connections. Serial, first and second sockets.
        if self.con:
            self.con.close()
        if self.vna_con1:
            self.vna_con1.close()
        if self.vna_con2:
            self.vna_con2.close()

    def _read_sensor_data(self, logger):
        """
        Grab auxiliary sensor data.

        :param logger: what device is being used to gather data.

        :return: Dictionary containing readings.
        """
        # Original logger used with the platform.
        if logger == "ESP 32":
            # Request temperature from ESP32
            self.con.write('GET TEMP\n'.encode('utf-8'))
            self.con.flush()

            # Read until the newline character, decode to utf-8,
            # and remove the ending newline character.
            data = self.con.readline().decode('utf-8').rstrip()
            # Get temperatures from the string.
            temp1, temp2 = [float(x) for x in data.split(',')]
            # Assign values to dictionary.
            temps = {"temp1": temp1, "temp2": temp2}
            return temps

        elif logger == "Omega 4SD":
            lookup_correlate = ["temp1", "temp2", "temp3", "temp4"]  # Used to name keys in temp_holder.
            temp_holder = {}  # Dictionary to hold temp key and temperature reading.
            for index, item in enumerate(self.possible_temps):  # Iterate through metadata to check if probe was named.
                # If named, add temp[iterator] to temp_holder.
                if item is not None:
                    probe = lookup_correlate[index]
                    temp_holder[probe] = None
            # Loop that takes in 16 byte readings and fills temp_holder, ignores readings from non-wanted channels.
            while None in temp_holder.values():
                try:
                    self.con.reset_input_buffer()  # Since we're not continuously streaming data, remove buffer.

                    packet = self.con.read(16)  # Read 16 bytes.

                    reading = packet.decode('utf-8')  # Decode so that we can use regex to remove non-numerical digits.

                    digit_stream = str(reading)
                    digit_stream = re.sub('[^0-9]', '', digit_stream)  # remove anything that's not 0-9

                    channel = "temp" + digit_stream[1]
                    # Logic for determining whether reading is wanted.
                    if channel not in temp_holder.keys():
                        print('Non Selected Channel')
                        continue
                    else:

                        units = digit_stream[2:4]  # Not using in function, Assumed to be Celcius.
                        sign = digit_stream[4]  # Binary 0/1 for positive/negative.
                        decimal = int(digit_stream[5])  # Num digits for decimal from right.

                        temp_value = digit_stream[6:]  # Temperature value.
                        if decimal == 0:
                            temp = int(temp_value)

                        else:
                            temp = temp_value[:-decimal] + '.' + temp_value[-decimal:]  # separate temps by decimal.
                        directionality = ["+", "-"]
                        temp_holder[channel] = float(directionality[int(sign)] + str(temp))  # Assign to dictionary.
                except ValueError:
                    print('Value error, Please check that thermocouple is connected!')
            return temp_holder  # Return Dictionary.

